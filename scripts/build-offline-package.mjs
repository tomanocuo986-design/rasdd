// يبني حزمة «النسخة بدون إنترنت» من ناتج البناء (بعد `npm run build`):
//   npm run build:offline [-- --dir .output --entry server/index.mjs --out offline-dist --ignore نص]
// الناتج في offline-dist/: app.pack (ملفات التطبيق فقط، مضغوطة، غير مشفّرة، تبقى على الخادم)،
// app.pack.meta.json، و launcher/ (المشغّل الذي يُضاف إلى كل تنزيل). التشفير بكلمة مرور المستخدم يتم عند التنزيل.
// لا يدخل في الحزمة: ملفات البيئة (.env*)، مجلد data، سجلات jsonl، قواعد sqlite. ويفشل البناء إن وُجد سر معروف داخل الملفات.
import { createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { fileURLToPath } from "node:url";
import { packFilesStream, safeSegments } from "./offline/pack-format.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const MANIFEST = ".rasd-manifest.json";
const ENTRY_CANDIDATES = ["server/index.mjs", "server/index.js"];
const SCAN_MAX_BYTES = 8 * 1024 * 1024;

// أسرار البيئة الحالية: إن وُجدت قيمتها حرفياً داخل ملفات الناتج فهذا تسريب (مثلاً قيمة سُرِّبت وقت البناء).
const SECRET_ENV = [
  "GEMINI_API_KEY",
  "LLM_API_KEY",
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_INVITE_CODE",
  "RASD_DATA_KEY",
  "RASD_DATA_KEY_PREV",
  "RASD_API_TOKENS",
  "POSTGRES_PASSWORD",
];
const SECRET_PATTERNS = [
  ["مفتاح Google API", /AIza[0-9A-Za-z_-]{35}/],
  ["مفتاح خاص PEM", /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ["رابط قاعدة بيانات ببيانات دخول", /postgres(?:ql)?:\/\/[^\s:/@'"`]+:[^\s@'"`/]{3,}@[^\s'"`]+/],
];

const isExcludedName = (name) =>
  name === ".env" ||
  name.startsWith(".env.") ||
  /\.(jsonl|sqlite3?)$/i.test(name) ||
  name === "offline-guide.mp4"; // فيديو شرح الموقع: لا حاجة له في النسخة المحلية (يوفّر حجم كل تنزيل)
const isExcludedTop = (name) => name === "data" || name === ".data";

export function parseArgs(argv) {
  const o = { dir: "", entry: "", out: "offline-dist", ignore: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i] ?? "";
    if (a === "--dir") o.dir = next();
    else if (a === "--entry") o.entry = next();
    else if (a === "--out") o.out = next();
    else if (a === "--ignore") o.ignore.push(next());
    else throw new Error(`وسيط غير معروف: ${a}`);
  }
  return o;
}

async function walk(base, rel = "", out = [], excluded = []) {
  const entries = await readdir(path.join(base, rel), { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const e of entries) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    const abs = path.join(base, r);
    if (isExcludedName(e.name) || (!rel && isExcludedTop(e.name))) {
      excluded.push(r);
      continue;
    }
    let st = await stat(abs); // يتبع الروابط الرمزية
    if (e.isSymbolicLink() && st.isDirectory()) {
      throw new Error(`رابط رمزي لمجلد غير مدعوم: ${r}. أعد البناء بنسخة فعلية (بدون روابط).`);
    }
    if (st.isDirectory()) await walk(base, r, out, excluded);
    else if (st.isFile()) out.push({ rel: r, abs, size: st.size });
  }
  return { files: out, excluded };
}

async function scanForSecrets(files, ignore) {
  const literals = SECRET_ENV.map((k) => [k, process.env[k]]).filter(([, v]) => v && v.length >= 8);
  const hits = [];
  for (const f of files) {
    if (ignore.some((s) => f.rel.includes(s))) continue;
    if (f.size > SCAN_MAX_BYTES) continue;
    const text = (await readFile(f.abs)).toString("latin1");
    for (const [name, value] of literals) {
      if (text.includes(value)) hits.push(`${f.rel}: قيمة ${name} من البيئة الحالية`);
    }
    for (const [name, re] of SECRET_PATTERNS) {
      if (re.test(text)) hits.push(`${f.rel}: ${name}`);
    }
  }
  return hits;
}

export async function buildOfflinePackage(opts = {}) {
  const o = { dir: "", entry: "", out: "offline-dist", ignore: [], ...opts };
  const dir = path.resolve(root, o.dir || (existsSync(path.join(root, ".output")) ? ".output" : "dist"));
  if (!existsSync(dir)) throw new Error(`مجلد البناء غير موجود: ${dir}. شغّل npm run build أولاً.`);
  const outDir = path.resolve(root, o.out);

  const { files, excluded } = await walk(dir);
  for (const f of files) safeSegments(f.rel);

  const rels = new Set(files.map((f) => f.rel));
  const entry = o.entry || ENTRY_CANDIDATES.find((c) => rels.has(c));
  if (!entry || !rels.has(entry)) {
    throw new Error(
      `لم أجد ملف تشغيل الخادم داخل ${dir} (جرّبت: ${ENTRY_CANDIDATES.join("، ")}). مرّره بـ --entry.`,
    );
  }

  const hits = await scanForSecrets(files, o.ignore);
  if (hits.length) {
    throw new Error(
      `توقف البناء: وُجدت أسرار محتملة داخل الحزمة:\n  - ${hits.slice(0, 20).join("\n  - ")}\n` +
        `إن كانت إيجابية كاذبة (نص توثيقي داخل مكتبة) استعمل --ignore <جزء من المسار>.`,
    );
  }

  const manifestPath = path.join(outDir, ".manifest.tmp");
  await mkdir(outDir, { recursive: true });
  const manifest = Buffer.from(
    JSON.stringify({ format: 1, entry, builtAt: new Date().toISOString(), files: files.length }),
  );
  await writeFile(manifestPath, manifest);
  const all = [{ rel: MANIFEST, abs: manifestPath, size: manifest.length }, ...files];

  const tmp = path.join(outDir, "app.pack.tmp");
  await pipeline(packFilesStream(all), createGzip({ level: 9 }), createWriteStream(tmp));
  await rm(manifestPath, { force: true });
  const packPath = path.join(outDir, "app.pack");
  await rename(tmp, packPath);

  const sha = createHash("sha256").update(await readFile(packPath)).digest("hex");
  const { size } = await stat(packPath);
  const meta = { builtAt: new Date().toISOString(), size, files: files.length, entry, sha256: sha };
  await writeFile(path.join(outDir, "app.pack.meta.json"), JSON.stringify(meta, null, 2));

  // المشغّل: ملفات offline/launcher + نسخة من pack-format.mjs داخل lib/
  const launcherSrc = path.join(root, "offline", "launcher");
  const launcherOut = path.join(outDir, "launcher");
  await rm(launcherOut, { recursive: true, force: true });
  await mkdir(path.join(launcherOut, "lib"), { recursive: true });
  for (const name of await readdir(launcherSrc)) {
    const s = path.join(launcherSrc, name);
    if ((await stat(s)).isFile()) await copyFile(s, path.join(launcherOut, name));
  }
  await copyFile(path.join(here, "offline", "pack-format.mjs"), path.join(launcherOut, "lib", "pack-format.mjs"));

  return { ...meta, excluded, outDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = await buildOfflinePackage(parseArgs(process.argv.slice(2)));
    console.log(`تمت حزمة النسخة بدون إنترنت: ${r.files} ملفاً، ${(r.size / 1048576).toFixed(1)} م.ب → ${r.outDir}`);
    console.log(`ملف التشغيل: ${r.entry}`);
    if (r.excluded.length) console.log(`استُبعد (بيانات/بيئة): ${r.excluded.join("، ")}`);
  } catch (e) {
    console.error(String(e?.message ?? e));
    process.exit(1);
  }
}
