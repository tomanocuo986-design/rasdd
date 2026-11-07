#!/usr/bin/env node
// مشغّل رصد (النسخة بدون إنترنت): يفك تشفير التطبيق بكلمة المرور إلى مجلد مؤقت خاص، ويشغّله على
// 127.0.0.1 فقط، ويفتح المتصفح، وعند الإغلاق يحذف النسخة المفكوكة. البيانات تُحفظ في مجلد المستخدم.
// خيارات: --no-open (لا تفتح المتصفح). متغيرات: RASD_PORT، RASD_DATA_DIR، RASD_PACK_PASSWORD (للأتمتة).
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { pipeline } from "node:stream";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { decryptStream, safeSegments, unpackTo } from "./lib/pack-format.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PACK = path.join(here, "rasd-app.enc");
const PORT0 = Number(process.env.RASD_PORT) || 4717;
const NO_OPEN = process.argv.includes("--no-open");
const TMP_PREFIX = "rasd-offline-";

// English-only console output (cmd.exe cannot render Arabic correctly). Arabic arg kept for reference, not printed.
const say = (_ar, en) => console.log(en || _ar);
const fail = (_ar, en, code = 1) => {
  console.error(`\n[X] ${en || _ar}`);
  process.exit(code);
};

if (Number(process.versions.node.split(".")[0]) < 20) {
  fail("يلزم Node.js إصدار 20 أو أحدث (يفضّل 22 LTS) من nodejs.org", "Node.js 20+ is required");
}
if (!existsSync(PACK)) fail("ملف rasd-app.enc غير موجود بجانب المشغّل.", "rasd-app.enc is missing next to this launcher");

function dataDir() {
  if (process.env.RASD_DATA_DIR) return path.resolve(process.env.RASD_DATA_DIR);
  if (process.platform === "win32") return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "RasdOffline");
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "RasdOffline");
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "rasd-offline");
}

/** أسرار محلية تُولَّد أول مرة وتبقى في مجلد بيانات المستخدم. */
function localSecrets(dir) {
  const file = path.join(dir, "secrets.json");
  if (existsSync(file)) {
    try {
      const s = JSON.parse(readFileSync(file, "utf8"));
      if (s.authSecret && s.inviteCode) return s;
    } catch {
      /* يُعاد توليدها */
    }
  }
  const s = { authSecret: randomBytes(32).toString("hex"), inviteCode: randomBytes(10).toString("hex") };
  writeFileSync(file, JSON.stringify(s), { mode: 0o600 });
  return s;
}

function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin });
      rl.question(question, (a) => {
        rl.close();
        resolve(a);
      });
      return;
    }
    stdout.write(question);
    let val = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\r" || c === "\n" || c === "\u0004") {
          done();
          return resolve(val);
        }
        if (c === "\u0003") {
          done();
          process.exit(130);
        }
        if (c === "\u007f" || c === "\b") {
          if (val.length) {
            val = Array.from(val).slice(0, -1).join(""); // يحذف حرفاً كاملاً حتى لو كان من زوج بديل (surrogate)
            stdout.write("\b \b");
          }
        } else if (c >= " ") {
          val += c;
          stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

const pidAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

/** نسخ مفكوكة تركها تشغيل سابق انتهى بانقطاع مفاجئ (انقطاع كهرباء، قتل العملية). */
function cleanStale() {
  for (const name of readdirSync(os.tmpdir())) {
    if (!name.startsWith(TMP_PREFIX)) continue;
    const dir = path.join(os.tmpdir(), name);
    try {
      // لا نلمس إلا مجلداً حقيقياً يملكه المستخدم الحالي (لا رابطاً رمزياً ولا مجلد مستخدم آخر في /tmp مشترك)
      const st = lstatSync(dir);
      if (!st.isDirectory() || (typeof process.getuid === "function" && st.uid !== process.getuid())) continue;
      const pid = Number(readFileSync(path.join(dir, "owner.pid"), "utf8"));
      if (!pid || !pidAlive(pid)) rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ليس لنا أو قيد الإنشاء */
    }
  }
}

const portFree = (port) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
  });

function waitReady(port, child, ms = 60_000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (child.exitCode !== null) return reject(new Error("exited"));
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (res) => {
        res.resume();
        if ((res.statusCode ?? 500) < 500) resolve();
        else retry();
      });
      req.on("error", retry);
      req.on("timeout", () => req.destroy());
    };
    const retry = () => (Date.now() - t0 > ms ? reject(new Error("timeout")) : setTimeout(tick, 400));
    tick();
  });
}

function openBrowser(url) {
  try {
    const [cmd, args] =
      process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {
    /* العنوان مطبوع للنسخ */
  }
}

async function main() {
  console.log("\n  Rasd - Offline Copy\n");
  cleanStale();

  let sandbox = "";
  let child = null;
  let closing = false;
  const cleanup = () => {
    if (closing) return;
    closing = true;
    try {
      child?.kill();
    } catch {
      /* ميت */
    }
    if (sandbox) {
      try {
        rmSync(sandbox, { recursive: true, force: true });
      } catch {
        /* يُحذف في التشغيل التالي */
      }
    }
  };
  process.on("exit", cleanup);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => process.exit(0));

  sandbox = mkdtempSync(path.join(os.tmpdir(), TMP_PREFIX));
  writeFileSync(path.join(sandbox, "owner.pid"), String(process.pid), { mode: 0o600 });
  const appDir = path.join(sandbox, "app");
  mkdirSync(appDir, { mode: 0o700 });

  // فك التشفير (5 محاولات)
  const envPw = process.env.RASD_PACK_PASSWORD;
  let unpacked = null;
  for (let attempt = 1; attempt <= (envPw ? 1 : 5) && !unpacked; attempt++) {
    const pw = envPw ?? (await askHidden("Package password: "));
    try {
      const src = createReadStream(PACK);
      const out = pipeline(src, decryptStream(pw), createGunzip(), () => {});
      unpacked = await unpackTo(out, appDir);
    } catch (e) {
      rmSync(appDir, { recursive: true, force: true });
      mkdirSync(appDir, { mode: 0o700 });
      if (e?.code === "PACK_BAD_PASSWORD" && attempt < (envPw ? 1 : 5)) {
        say("", `Wrong password (${attempt}/5). Try again.`);
        continue;
      }
      if (e?.code === "PACK_BAD_PASSWORD") fail("كلمة المرور خاطئة أو الملف تالف.", "Wrong password or damaged file");
      if (String(e?.code).startsWith("PACK_")) fail("", `${e.code}: ${e.message}`);
      fail("", `Could not open the package: ${e?.message ?? e}`);
    }
  }
  if (!unpacked) fail("انتهت المحاولات.", "Too many attempts");

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.join(appDir, ".rasd-manifest.json"), "utf8"));
    safeSegments(manifest.entry);
  } catch {
    fail("الحزمة لا تحتوي بيان تشغيل صالحاً.", "Invalid manifest");
  }
  const entry = path.join(appDir, ...manifest.entry.split("/"));
  if (!existsSync(entry)) fail("ملف تشغيل الخادم غير موجود في الحزمة.", "Server entry missing");

  const dir = dataDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const secrets = localSecrets(dir);

  // بيانات المتصفح (التقارير المحلية) مرتبطة بالمنفذ؛ تغييره الصامت يُخفي بيانات المدقق. لذلك نتوقف افتراضياً.
  let port = PORT0;
  if (!(await portFree(port))) {
    if (process.env.RASD_ALLOW_OTHER_PORT !== "1") {
      fail(
        "",
        `Port ${PORT0} is busy (is another copy of Rasd already running?). Close it and run again. ` +
          `Using a different port would hide your saved reports; to accept that anyway set RASD_ALLOW_OTHER_PORT=1.`,
      );
    }
    for (let i = 0; i < 10 && !(await portFree(port)); i++) port = PORT0 + i + 1;
    say("", `Port ${PORT0} is busy, using ${port} instead. Browser data is tied to the port, so previous data will not appear.`);
  }

  const keep = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "windir", "COMSPEC", "PATHEXT", "TEMP", "TMP", "TMPDIR", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "LANG", "LC_ALL"];
  const env = Object.fromEntries(keep.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  Object.assign(env, {
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    NITRO_HOST: "127.0.0.1",
    PORT: String(port),
    NITRO_PORT: String(port),
    RASD_OFFLINE: "1",
    AUTH_DATA_DIR: path.join(dir, "data"),
    AUTH_SECRET: secrets.authSecret,
    AUTH_REGISTRATION: "invite",
    AUTH_INVITE_CODE: secrets.inviteCode,
    TRUST_PROXY_HOPS: "0",
    LEGAL_LIBRARY: "off",
    LEGAL_FETCH: "off",
    OFFLINE_PACKAGE: "off", // النسخة المحلية لا تُصدِّر نسخاً أخرى
  });

  child = spawn(process.execPath, [entry], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const tail = [];
  const keepTail = (b) => {
    for (const line of String(b).split(/\r?\n/)) if (line.trim()) tail.push(line);
    while (tail.length > 40) tail.shift();
  };
  child.stdout.on("data", keepTail);
  child.stderr.on("data", keepTail);
  child.on("exit", (code) => {
    if (!closing) {
      console.error(`\nServer stopped (code ${code}).\n${tail.slice(-15).join("\n")}`);
      process.exit(code || 1);
    }
  });

  try {
    await waitReady(port, child);
  } catch {
    fail("", `Server did not start.\n${tail.slice(-15).join("\n")}`);
  }

  const url = `http://127.0.0.1:${port}/`;
  console.log("\n  [OK] Running on your computer only:");
  console.log(`    ${url}`);
  console.log(`\n  Invite code (to create the first account):  ${secrets.inviteCode}`);
  console.log(`  Accounts data folder: ${dir}`);
  console.log("\n  Do not close this window while using the app. To stop: close it or press Ctrl+C.\n");
  if (!NO_OPEN) openBrowser(url);
  await new Promise(() => {});
}

main().catch((e) => fail(String(e?.message ?? e)));
