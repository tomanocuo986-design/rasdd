// يبني حزمة «النسخة بدون إنترنت» من ناتج البناء (بعد `npm run build`):
//   npm run build:offline [-- --dir .output --entry server/index.mjs --out offline-dist --ignore نص]
// الناتج في offline-dist/: app.pack (ملفات التطبيق فقط، مضغوطة، غير مشفّرة، تبقى على الخادم)،
// app.pack.meta.json، و launcher/ (المشغّل الذي يُضاف إلى كل تنزيل). التشفير بكلمة مرور المستخدم يتم عند التنزيل.
// لا يدخل في الحزمة: ملفات البيئة (.env*)، مجلد data، سجلات jsonl، قواعد sqlite. ويفشل البناء إن وُجد سر معروف داخل الملفات.
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { copyFile, mkdir, open, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
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
const SCAN_CHUNK = 4 * 1024 * 1024; // الملفات الكبيرة تُفحص على دفعات متداخلة (لا يُتخطّى أي ملف)

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
    if (e.isSymbolicLink() && st.isFile()) {
      // رابط إلى ملف: يجب أن يقع هدفه داخل مجلد البناء أو المشروع، وإلا قد يُضمَّن ملف من خارجهما (مفاتيح، إعدادات النظام).
      const real = await realpath(abs);
      const inside = (p) => real === p || real.startsWith(p + path.sep);
      if (!inside(path.resolve(base)) && !inside(root)) {
        throw new Error(`رابط رمزي يشير إلى ملف خارج المشروع: ${r}. أعد البناء بنسخة فعلية.`);
      }
    }
    if (st.isDirectory()) await walk(base, r, out, excluded);
    else if (st.isFile()) out.push({ rel: r, abs, size: st.size });
  }
  return { files: out, excluded };
}

/** القيم الحرفية التي يجب ألا تظهر في الناتج: القيمة كاملة + أجزاؤها (رموز API، كلمة مرور قاعدة البيانات). */
export function secretLiterals(env = process.env) {
  const out = new Map(); // value(latin1 of utf8 bytes) -> name
  const add = (name, v) => {
    const t = String(v ?? "").trim();
    if (t.length >= 8) out.set(Buffer.from(t, "utf8").toString("latin1"), name);
  };
  for (const k of SECRET_ENV) {
    const v = env[k];
    if (!v) continue;
    add(k, v);
    if (k === "RASD_API_TOKENS" || k === "RASD_DATA_KEY_PREV") {
      for (const part of v.split(",")) {
        add(k, part);
        const i = part.indexOf(":");
        if (i > 0) add(k, part.slice(i + 1));
      }
    }
    if (k === "DATABASE_URL") {
      try {
        const u = new URL(v);
        if (u.password) add(k, decodeURIComponent(u.password));
      } catch {
        /* القيمة الكاملة مفحوصة أعلاه */
      }
    }
  }
  return [...out].map(([value, name]) => [name, value]);
}

async function scanFile(f, literals, buf, overlap) {
  const labels = new Set();
  const fh = await open(f.abs, "r");
  try {
    let pos = 0;
    let carry = "";
    for (;;) {
      const { bytesRead } = await fh.read(buf, 0, buf.length, pos);
      if (!bytesRead) break;
      pos += bytesRead;
      const text = carry + buf.subarray(0, bytesRead).toString("latin1");
      for (const [name, value] of literals) if (text.includes(value)) labels.add(`قيمة ${name} من البيئة الحالية`);
      for (const [name, re] of SECRET_PATTERNS) if (re.test(text)) labels.add(name);
      carry = text.slice(-overlap);
    }
  } finally {
    await fh.close();
  }
  return labels;
}

async function scanForSecrets(files, ignore) {
  const literals = secretLiterals();
  const overlap = Math.max(4096, ...literals.map(([, v]) => v.length));
  const buf = Buffer.alloc(SCAN_CHUNK);
  const hits = [];
  for (const f of files) {
    if (ignore.some((s) => f.rel.includes(s))) continue;
    for (const label of await scanFile(f, literals, buf, overlap)) hits.push(`${f.rel}: ${label}`);
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
  try {
    await pipeline(packFilesStream(all), createGzip({ level: 9 }), createWriteStream(tmp));
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  } finally {
    await rm(manifestPath, { force: true });
  }
  const packPath = path.join(outDir, "app.pack");
  await rename(tmp, packPath);

  const hash = createHash("sha256");
  for await (const c of createReadStream(packPath)) hash.update(c); // بثّ: الحزمة قد تبلغ مئات الميغابايت
  const sha = hash.digest("hex");
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
