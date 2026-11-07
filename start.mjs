#!/usr/bin/env node
// تشغيل الخادم المبني (npm run build ثم npm start). nitro يقرأ PORT / NITRO_PORT و HOST / NITRO_HOST.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const ENTRIES = [".output/server/index.mjs", ".output/server/index.js"];
const entry = ENTRIES.map((e) => path.join(root, e)).find((p) => existsSync(p));

if (!entry) {
  console.error("لم أجد ناتج البناء (.output/server/index.mjs). شغّل `npm run build` أولاً.");
  process.exit(1);
}

const child = spawn(process.execPath, [entry], {
  cwd: root,
  stdio: "inherit",
  env: { NODE_ENV: "production", ...process.env },
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
