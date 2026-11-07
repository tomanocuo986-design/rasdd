import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import JSZip from "jszip";
import { encryptStream } from "../../scripts/offline/pack-format.mjs";

// النسخة بدون إنترنت: حزمة التطبيق (تُبنى وقت النشر بـ `npm run build:offline`) تُشفَّر عند التنزيل
// بكلمة مرور يختارها المستخدم، وتُسلَّم في ملف zip فيه المشغّل. لا تُحفظ الكلمة ولا تُسجَّل.
// انظر docs/OFFLINE_PACKAGE.ar.md.

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

export const offlineEnabled = () => process.env.OFFLINE_PACKAGE !== "off";
const packageDir = () => path.resolve(process.env.OFFLINE_PACKAGE_DIR || path.join(process.cwd(), "offline-dist"));

export type OfflineStatus = {
  enabled: boolean;
  available: boolean;
  sizeMB?: number;
  builtAt?: string;
};

export async function offlineStatus(): Promise<OfflineStatus> {
  if (!offlineEnabled()) return { enabled: false, available: false };
  try {
    const meta = JSON.parse(await readFile(path.join(packageDir(), "app.pack.meta.json"), "utf8"));
    await stat(path.join(packageDir(), "app.pack"));
    return {
      enabled: true,
      available: true,
      sizeMB: Math.round((meta.size / 1048576) * 10) / 10,
      builtAt: String(meta.builtAt ?? ""),
    };
  } catch {
    return { enabled: true, available: false };
  }
}

/** يعيد نص الخطأ بالعربية أو null إن كانت الكلمة مقبولة. */
export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string") return "أدخل كلمة مرور.";
  if (pw.length < MIN_PASSWORD) return `كلمة المرور قصيرة: ${MIN_PASSWORD} أحرف على الأقل.`;
  if (pw.length > MAX_PASSWORD) return `كلمة المرور طويلة: ${MAX_PASSWORD} حرفاً كحد أقصى.`;
  if (!pw.trim()) return "كلمة المرور لا يمكن أن تكون فراغات فقط.";
  if (new Set(pw).size < 4) return "كلمة المرور سهلة التخمين: نوّع الأحرف.";
  return null;
}

let busy = false;

export class OfflineBusyError extends Error {}
export class OfflineUnavailableError extends Error {}

/** يبني zip التنزيل: rasd-offline/{rasd-app.enc, start.mjs, lib/pack-format.mjs, سكربتات التشغيل, README}. */
export async function buildOfflineZip(password: string): Promise<{ body: Buffer; encBytes: number }> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const dir = packageDir();
  const packPath = path.join(dir, "app.pack");
  const launcherDir = path.join(dir, "launcher");
  try {
    await stat(packPath);
    await stat(launcherDir);
  } catch {
    throw new OfflineUnavailableError("الحزمة لم تُبنَ على الخادم بعد (npm run build:offline).");
  }
  if (busy) throw new OfflineBusyError("يجري تجهيز حزمة أخرى، حاول بعد دقيقة.");
  busy = true;
  try {
    const parts: Buffer[] = [];
    await pipeline(
      createReadStream(packPath),
      encryptStream(password),
      new Writable({
        write(chunk, _e, cb) {
          parts.push(chunk);
          cb();
        },
      }),
    );
    const enc = Buffer.concat(parts);

    const zip = new JSZip();
    const top = zip.folder("rasd-offline")!;
    top.file("rasd-app.enc", enc, { compression: "STORE" });
    const add = async (rel: string) => {
      const data = await readFile(path.join(launcherDir, rel));
      const exec = /\.(command|sh)$/.test(rel);
      top.file(rel, data, { unixPermissions: exec ? 0o755 : 0o644 });
    };
    for (const name of await readdir(launcherDir)) {
      if ((await stat(path.join(launcherDir, name))).isFile()) await add(name);
    }
    await add("lib/pack-format.mjs");
    const body = await zip.generateAsync({
      type: "nodebuffer",
      platform: "UNIX",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    return { body, encBytes: enc.length };
  } finally {
    busy = false;
  }
}
