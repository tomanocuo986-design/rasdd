// يفحص اتساق package.json: كل سكربت يشغّل ملفاً بـ `node <ملف>` يجب أن يكون الملف موجوداً.
// (سكربت start كان يشير إلى ملف غير موجود في الحزمة دون أن يلاحظ أحد.)
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function missingScriptFiles(pkg, exists = (p) => existsSync(path.join(root, p))) {
  const out = [];
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    for (const part of String(cmd).split(/&&|\|\||;/)) {
      const m = /^\s*node\s+(?:--[\w-]+(?:=\S+)?\s+)*(\S+\.m?js)\b/.exec(part);
      if (m && !exists(m[1])) out.push({ script: name, file: m[1] });
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const miss = missingScriptFiles(pkg);
  for (const m of miss) console.error(`package.json: السكربت "${m.script}" يشير إلى ملف غير موجود: ${m.file}`);
  if (miss.length) process.exit(1);
  console.log("package.json: كل ملفات السكربتات موجودة.");
}
