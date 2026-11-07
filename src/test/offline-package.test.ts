// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {
  CHUNK,
  PackError,
  decryptStream,
  encryptStream,
  packFilesStream,
  safeSegments,
  unpackTo,
} from "../../scripts/offline/pack-format.mjs";
import { buildOfflinePackage, secretLiterals } from "../../scripts/build-offline-package.mjs";
import { buildOfflineZip, offlineAllowedFor, offlineStatus, passwordProblem } from "@/server/offline-package.ts";

const PW = "كلمة-سرّ طويلة 123";
const tmp: string[] = [];
const mk = () => {
  const d = mkdtempSync(path.join(os.tmpdir(), "offt-"));
  tmp.push(d);
  return d;
};
afterEach(() => {
  while (tmp.length) rmSync(tmp.pop()!, { recursive: true, force: true });
  delete process.env.OFFLINE_PACKAGE_DIR;
  delete process.env.OFFLINE_PACKAGE;
});

const collect = async (r: Readable) => {
  const parts: Buffer[] = [];
  for await (const c of r) parts.push(Buffer.from(c));
  return Buffer.concat(parts);
};
const enc = (data: Buffer, pw = PW) => collect(Readable.from([data], { objectMode: false }).pipe(encryptStream(pw, { logN: 14 })));
const dec = (data: Buffer, pw = PW) => collect(Readable.from([data], { objectMode: false }).pipe(decryptStream(pw)));
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as PackError).code;
  }
  return "OK";
};

describe("pack-format: التشفير", () => {
  it("يعيد البيانات كما هي (فارغ، صغير، عدة أجزاء)", async () => {
    for (const n of [0, 1, CHUNK - 1, CHUNK, CHUNK + 1, CHUNK * 2 + 5]) {
      const data = Buffer.alloc(n, 7);
      expect((await dec(await enc(data))).equals(data)).toBe(true);
    }
  });
  it("لا يظهر النص الأصلي داخل الناتج، وكل تشفير مختلف (salt وnonce عشوائيان)", async () => {
    const data = Buffer.from("GEMINI_SECRET_MARKER".repeat(50));
    const a = await enc(data);
    expect(a.includes(Buffer.from("GEMINI_SECRET_MARKER"))).toBe(false);
    expect((await enc(data)).equals(a)).toBe(false);
  });
  it("كلمة خاطئة → PACK_BAD_PASSWORD", async () => {
    expect(await codeOf(dec(await enc(Buffer.from("x")), "كلمة خاطئة تماماً"))).toBe("PACK_BAD_PASSWORD");
  });
  it("تعديل بايت واحد في أي موضع يُكتشف", async () => {
    const good = await enc(Buffer.alloc(CHUNK + 100, 1));
    for (const pos of [3, 8, 12, 30, 40, 5000, good.length - 3]) {
      const bad = Buffer.from(good);
      bad[pos] ^= 1;
      expect(await codeOf(dec(bad))).not.toBe("OK");
    }
  });
  it("القصّ (حذف الجزء الأخير أو بعضه) يُكتشف", async () => {
    const good = await enc(Buffer.alloc(CHUNK * 2 + 10, 1));
    expect(await codeOf(dec(good.subarray(0, good.length - 1)))).toBe("PACK_TRUNCATED");
    expect(await codeOf(dec(good.subarray(0, 33 + 4 + CHUNK + 16)))).toBe("PACK_TRUNCATED");
    expect(await codeOf(dec(good.subarray(0, 10)))).toBe("PACK_TRUNCATED");
  });
  it("بيانات زائدة بعد النهاية وسحب معاملات scrypt مخادعة مرفوضان", async () => {
    const good = await enc(Buffer.from("abc"));
    expect(await codeOf(dec(Buffer.concat([good, Buffer.from([1, 2, 3])])))).toBe("PACK_CORRUPT");
    const heavy = Buffer.from(good);
    heavy[8] = 25; // يحاول إجبار المشغّل على ذاكرة ضخمة
    expect(await codeOf(dec(heavy))).toBe("PACK_BAD_PARAMS");
    const notPack = Buffer.from("this is not a pack at all, definitely not");
    expect(await codeOf(dec(notPack))).toBe("PACK_BAD_MAGIC");
  });
});

describe("pack-format: السجلات والمسارات", () => {
  it("safeSegments يرفض مسارات الهروب", () => {
    for (const bad of ["", "/etc/passwd", "../x", "a/../b", "a//b", "a\\b", "C:/x", "a/./b", "a\0b"]) {
      expect(() => safeSegments(bad), bad).toThrow();
    }
    expect(safeSegments("server/chunks/ملف.mjs")).toEqual(["server", "chunks", "ملف.mjs"]);
  });
  it("حزمة → فك يعيد نفس الملفات، ولا يكتب خارج المجلد", async () => {
    const src = mk();
    mkdirSync(path.join(src, "a/b"), { recursive: true });
    writeFileSync(path.join(src, "a/b/ملف.txt"), "مرحبا");
    writeFileSync(path.join(src, "big.bin"), Buffer.alloc(CHUNK * 2 + 3, 9));
    writeFileSync(path.join(src, "empty"), "");
    const files = [
      { rel: "a/b/ملف.txt", abs: path.join(src, "a/b/ملف.txt"), size: 10 },
      { rel: "big.bin", abs: path.join(src, "big.bin"), size: CHUNK * 2 + 3 },
      { rel: "empty", abs: path.join(src, "empty"), size: 0 },
    ];
    const packed = await collect(packFilesStream(files).pipe(createGzip()));
    const dest = mk();
    const out = Readable.from([await enc(packed)], { objectMode: false }).pipe(decryptStream(PW)).pipe(createGunzip());
    const r = await unpackTo(out, dest);
    expect(r.files).toBe(3);
    expect(readFileSync(path.join(dest, "a/b/ملف.txt"), "utf8")).toBe("مرحبا");
    expect(readFileSync(path.join(dest, "big.bin")).length).toBe(CHUNK * 2 + 3);
  });
  it("سجل بمسار خبيث يُرفض قبل أي كتابة", async () => {
    const evil = Buffer.concat([
      Buffer.from([0, 7]), Buffer.from("../evil"), Buffer.alloc(8, 0), Buffer.from([0, 0]),
    ]);
    const dest = mk();
    expect(await codeOf(unpackTo(Readable.from([evil]), dest))).toBe("PACK_BAD_PATH");
    expect(existsSync(path.join(dest, "..", "evil"))).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("يقبل الجيدة ويرفض القصيرة والفراغ والمكررة", () => {
    expect(passwordProblem("xK9-vq2!mTz7")).toBeNull();
    expect(passwordProblem("abcdefghij1k")).toMatch(/شائعاً/);
    expect(passwordProblem("Rasd-Offline-2026")).toMatch(/شائعاً/);
    expect(passwordProblem("493817265048")).toMatch(/الأرقام/);
    expect(passwordProblem("abababababab")).toMatch(/سهلة/);
    expect(passwordProblem("short")).toMatch(/قصيرة/);
    expect(passwordProblem(" ".repeat(14))).toMatch(/فراغات/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/سهلة/);
    expect(passwordProblem(123 as unknown)).toBeTruthy();
    expect(passwordProblem("x".repeat(200))).toMatch(/طويلة/);
  });
});

describe("بناء الحزمة (build-offline-package)", () => {
  const fakeApp = () => {
    const d = mk();
    mkdirSync(path.join(d, "server/chunks"), { recursive: true });
    mkdirSync(path.join(d, "public"), { recursive: true });
    mkdirSync(path.join(d, "data"), { recursive: true });
    writeFileSync(path.join(d, "server/index.mjs"), "export default 1");
    writeFileSync(path.join(d, "server/chunks/a.mjs"), "export const a = 1");
    writeFileSync(path.join(d, "public/index.html"), "<html></html>");
    writeFileSync(path.join(d, "data/users.json"), '{"1001":"hash"}');
    writeFileSync(path.join(d, ".env"), "GEMINI_API_KEY=real");
    writeFileSync(path.join(d, "server/audit-log.jsonl"), '{"a":1}');
    return d;
  };

  it("يستبعد البيانات والبيئة ويكتب بيان التشغيل", async () => {
    const out = mk();
    const r = await buildOfflinePackage({ dir: fakeApp(), out });
    expect(r.entry).toBe("server/index.mjs");
    expect(r.excluded.sort()).toEqual([".env", "data", "server/audit-log.jsonl"]);
    // نفك الحزمة غير المشفّرة ونتأكد ألا شيء من البيانات فيها
    const dest = mk();
    await unpackTo(createReadStream(path.join(out, "app.pack")).pipe(createGunzip()), dest);
    const all = readdirSync(dest, { recursive: true }).map(String);
    expect(all.some((f) => f.includes("users.json") || f.includes(".env") || f.includes("audit-log"))).toBe(false);
    expect(JSON.parse(readFileSync(path.join(dest, ".rasd-manifest.json"), "utf8")).entry).toBe("server/index.mjs");
    expect(existsSync(path.join(out, "launcher", "lib", "pack-format.mjs"))).toBe(true);
    expect(existsSync(path.join(out, "launcher", "start.mjs"))).toBe(true);
  });
  it("يفشل إن وُجد سر معروف أو نمط سر داخل الملفات", async () => {
    const d = fakeApp();
    writeFileSync(path.join(d, "server/chunks/leak.mjs"), 'const k="AIza' + "A".repeat(35) + '"');
    await expect(buildOfflinePackage({ dir: d, out: mk() })).rejects.toThrow(/أسرار محتملة/);
    process.env.DATABASE_URL = "postgres://u:pass12345@db.internal/x";
    try {
      const d2 = fakeApp();
      writeFileSync(path.join(d2, "public/app.js"), "x=" + process.env.DATABASE_URL);
      await expect(buildOfflinePackage({ dir: d2, out: mk() })).rejects.toThrow(/DATABASE_URL/);
    } finally {
      delete process.env.DATABASE_URL;
    }
  });
  it("يفحص الملفات الكبيرة (أكبر من 8 م.ب) ولا يتخطّاها، حتى لو وقع السر عند حدّ الدفعة", async () => {
    process.env.AUTH_SECRET = "s3cr3t-value-0123456789";
    try {
      const d = fakeApp();
      const pad = "a".repeat(4 * 1024 * 1024 - 5); // يجعل السر يقطع حدّ الدفعة الأولى
      writeFileSync(path.join(d, "server/chunks/big.mjs"), pad + process.env.AUTH_SECRET + "b".repeat(6 * 1024 * 1024));
      await expect(buildOfflinePackage({ dir: d, out: mk() })).rejects.toThrow(/AUTH_SECRET/);
    } finally {
      delete process.env.AUTH_SECRET;
    }
  });
  it("secretLiterals تفصل رموز API وكلمة مرور قاعدة البيانات عن القيمة الكاملة", () => {
    const lits = secretLiterals({
      RASD_API_TOKENS: "auditor1:tok-aaaaaaaaaaaaaaaa,auditor2:tok-bbbbbbbbbbbbbbbb",
      DATABASE_URL: "postgres://rasd:p%40ss-word-123@db:5432/rasd",
    } as NodeJS.ProcessEnv).map(([, v]) => v);
    expect(lits).toContain("tok-aaaaaaaaaaaaaaaa");
    expect(lits).toContain("tok-bbbbbbbbbbbbbbbb");
    expect(lits).toContain("p@ss-word-123");
  });
  it("يرفض رابطاً رمزياً لملف يقع خارج المشروع", async () => {
    const outside = mk();
    writeFileSync(path.join(outside, "id_rsa"), "private");
    const d = fakeApp();
    symlinkSync(path.join(outside, "id_rsa"), path.join(d, "public/key.txt"), "file");
    await expect(buildOfflinePackage({ dir: d, out: mk() })).rejects.toThrow(/خارج المشروع/);
  });
  it("يفشل بوضوح إن غاب ملف تشغيل الخادم أو كان هناك رابط رمزي لمجلد", async () => {
    const d = mk();
    writeFileSync(path.join(d, "x.txt"), "x");
    await expect(buildOfflinePackage({ dir: d, out: mk() })).rejects.toThrow(/ملف تشغيل الخادم/);
    const d2 = fakeApp();
    symlinkSync(path.join(d2, "public"), path.join(d2, "link"), "dir");
    await expect(buildOfflinePackage({ dir: d2, out: mk() })).rejects.toThrow(/رابط رمزي/);
  });
});

describe("زيب التنزيل + المشغّل (من البداية للنهاية)", () => {
  it("status غير جاهز ثم جاهز", async () => {
    process.env.OFFLINE_PACKAGE_DIR = mk();
    expect((await offlineStatus()).available).toBe(false);
    process.env.OFFLINE_PACKAGE = "off";
    expect(await offlineStatus()).toEqual({ enabled: false, available: false });
  });

  it("zip يحوي المشغّل والحزمة المشفّرة؛ المشغّل يفكها ويشغّل الخادم على 127.0.0.1 ويحذف النسخة عند الإغلاق", async () => {
    // تطبيق وهمي يمثل مخرجات Nitro: خادم http يطبع بيئته الأساسية
    const app = mk();
    mkdirSync(path.join(app, "server"), { recursive: true });
    writeFileSync(
      path.join(app, "server/index.mjs"),
      `import http from "node:http";
       http.createServer((q, s) => { s.setHeader("content-type","application/json");
         s.end(JSON.stringify({ host: process.env.HOST, off: process.env.RASD_OFFLINE, reg: process.env.AUTH_REGISTRATION,
           gem: process.env.GEMINI_API_KEY ?? null, db: process.env.DATABASE_URL ?? null, lib: process.env.LEGAL_LIBRARY, cwd: process.cwd() })); })
       .listen(Number(process.env.PORT), process.env.HOST);`,
    );
    const dist = mk();
    await buildOfflinePackage({ dir: app, out: dist });
    process.env.OFFLINE_PACKAGE_DIR = dist;
    const { body } = await buildOfflineZip(PW);

    const z = await JSZip.loadAsync(body);
    const names = Object.keys(z.files).filter((n) => !z.files[n].dir).sort();
    expect(names).toEqual([
      "rasd-offline/Start-Rasd.bat",
      "rasd-offline/lib/pack-format.mjs",
      "rasd-offline/rasd-app.enc",
      "rasd-offline/README.txt",
      "rasd-offline/start-rasd.command",
      "rasd-offline/start-rasd.sh",
      "rasd-offline/start.mjs",
    ].sort());
    const encBuf = await z.file("rasd-offline/rasd-app.enc")!.async("nodebuffer");
    expect(encBuf.includes(Buffer.from("createServer"))).toBe(false); // لا نص مقروء
    expect(z.files["rasd-offline/start-rasd.sh"].unixPermissions! & 0o111).not.toBe(0);
    // .bat بنهايات CRLF، وسكربتات sh بنهايات LF
    const bat = await z.file("rasd-offline/Start-Rasd.bat")!.async("string");
    expect(/(^|[^\r])\n/.test(bat)).toBe(false);
    expect((await z.file("rasd-offline/start-rasd.sh")!.async("string")).includes("\r")).toBe(false);

    const root = mk();
    for (const n of names) {
      const p = path.join(root, n);
      mkdirSync(path.dirname(p), { recursive: true });
      writeFileSync(p, await z.file(n)!.async("nodebuffer"));
    }
    const dataDir = mk();
    const port = 47000 + Math.floor(Math.random() * 1000);
    const env = {
      ...process.env,
      RASD_PORT: String(port),
      RASD_DATA_DIR: dataDir,
      GEMINI_API_KEY: "must-not-leak",
      DATABASE_URL: "postgres://must-not-leak",
    };

    // كلمة خاطئة → خروج برمز غير صفري ولا خادم
    const bad = spawn(process.execPath, [path.join(root, "rasd-offline/start.mjs"), "--no-open"], {
      env: { ...env, RASD_PACK_PASSWORD: "كلمة خاطئة كلياً" },
    });
    const badCode = await new Promise<number>((r) => bad.on("exit", (c) => r(c ?? -1)));
    expect(badCode).not.toBe(0);

    const tmpBefore = readdirSync(os.tmpdir()).filter((n) => n.startsWith("rasd-offline-")).length;
    const ok = spawn(process.execPath, [path.join(root, "rasd-offline/start.mjs"), "--no-open"], {
      env: { ...env, RASD_PACK_PASSWORD: PW },
    });
    let out = "";
    ok.stdout.on("data", (b) => (out += b));
    ok.stderr.on("data", (b) => (out += b));
    const t0 = Date.now();
    while (!out.includes(`http://127.0.0.1:${port}/`) && Date.now() - t0 < 30000) {
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(out).toContain(`http://127.0.0.1:${port}/`);
    const res = await (await fetch(`http://127.0.0.1:${port}/`)).json();
    expect(res).toMatchObject({ host: "127.0.0.1", off: "1", reg: "invite", gem: null, db: null, lib: "off" });
    expect(readFileSync(path.join(dataDir, "secrets.json"), "utf8")).toContain("inviteCode");
    expect(out).toMatch(/Invite code/);
    expect(readdirSync(os.tmpdir()).filter((n) => n.startsWith("rasd-offline-")).length).toBe(tmpBefore + 1);

    ok.kill("SIGINT");
    await new Promise((r) => ok.on("exit", r));
    expect(readdirSync(os.tmpdir()).filter((n) => n.startsWith("rasd-offline-")).length).toBe(tmpBefore);
    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
  }, 90000);
});

describe("offlineAllowedFor", () => {
  it("allows admins and blocks others by default", () => {
    expect(offlineAllowedFor(true, {})).toBe(true);
    expect(offlineAllowedFor(false, {})).toBe(false);
  });
  it("OFFLINE_PACKAGE_ALLOW_ALL=1 opens it to every signed-in user", () => {
    expect(offlineAllowedFor(false, { OFFLINE_PACKAGE_ALLOW_ALL: "1" } as any)).toBe(true);
    expect(offlineAllowedFor(false, { OFFLINE_PACKAGE_ALLOW_ALL: "0" } as any)).toBe(false);
  });
});
