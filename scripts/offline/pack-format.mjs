// صيغة حزمة النسخة بدون إنترنت (RASDPK01). ملف واحد بلا اعتماديات خارجية: يُستعمل في الخادم (تشفير)
// وفي المشغّل على جهاز المستخدم (فك التشفير). نسخة منه تُوضع في الحزمة المُنزَّلة باسم lib/pack-format.mjs.
//
// الطبقات: ملفات التطبيق → سجلات (مسار + حجم + بيانات) → gzip → تشفير مجزّأ AES-256-GCM.
// المفتاح: scrypt من كلمة المرور + salt عشوائي (يُخزَّن في رأس الملف). كل جزء 1 م.ب له وسم مصادقة،
// ورأس الملف وطول الجزء (وفيه علَم «الجزء الأخير») داخلان في البيانات المصادَق عليها:
// فأي تعديل أو حذف أو إعادة ترتيب أو قصّ للملف يُكتشف عند الفك.
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";

export const MAGIC = Buffer.from("RASDPK01");
export const CHUNK = 1 << 20;
export const DEFAULT_LOG_N = 16;
const MIN_LOG_N = 14;
const MAX_LOG_N = 18; // 256 م.ب ذاكرة كحد أقصى عند الفك (يمنع رأساً خبيثاً يستنزف الذاكرة)
const HEADER_LEN = 8 + 1 + 16 + 8; // magic + logN + salt + noncePrefix
const TAG_LEN = 16;
const FINAL_BIT = 0x80000000;

export class PackError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.code = code;
  }
}

function deriveKey(password, salt, logN) {
  return new Promise((resolve, reject) => {
    scrypt(
      String(password).normalize("NFKC"),
      salt,
      32,
      { N: 2 ** logN, r: 8, p: 1, maxmem: 512 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

const nonceFor = (prefix, counter) => {
  const n = Buffer.alloc(12);
  prefix.copy(n, 0);
  n.writeUInt32BE(counter, 8);
  return n;
};

/** Transform: بايتات خام ← حزمة مشفّرة. */
export function encryptStream(password, { logN = DEFAULT_LOG_N } = {}) {
  if (!Number.isInteger(logN) || logN < MIN_LOG_N || logN > MAX_LOG_N) {
    throw new PackError("PACK_BAD_PARAMS", "معامل scrypt خارج المدى.");
  }
  const salt = randomBytes(16);
  const prefix = randomBytes(8);
  const header = Buffer.concat([MAGIC, Buffer.from([logN]), salt, prefix]);
  let key = null;
  let counter = 0;
  let pending = Buffer.alloc(0);

  const seal = (plain, final) => {
    if (counter > 0xffffffff) throw new PackError("PACK_TOO_LARGE");
    const lenField = Buffer.alloc(4);
    lenField.writeUInt32BE(((plain.length | (final ? FINAL_BIT : 0)) >>> 0));
    const c = createCipheriv("aes-256-gcm", key, nonceFor(prefix, counter++));
    c.setAAD(Buffer.concat([header, lenField]));
    const ct = Buffer.concat([c.update(plain), c.final()]);
    return Buffer.concat([lenField, ct, c.getAuthTag()]);
  };
  const ensureKey = async (self) => {
    if (key) return;
    key = await deriveKey(password, salt, logN);
    self.push(header);
  };

  return new Transform({
    async transform(chunk, _enc, cb) {
      try {
        await ensureKey(this);
        pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
        while (pending.length > CHUNK) {
          this.push(seal(pending.subarray(0, CHUNK), false));
          pending = pending.subarray(CHUNK);
        }
        cb();
      } catch (e) {
        cb(e);
      }
    },
    async flush(cb) {
      try {
        await ensureKey(this);
        this.push(seal(pending, true)); // جزء أخير دائماً (وقد يكون فارغاً)
        cb();
      } catch (e) {
        cb(e);
      }
    },
  });
}

/** Transform: حزمة مشفّرة ← بايتات خام. يرمي PackError برمز: PACK_BAD_PASSWORD | PACK_CORRUPT | PACK_TRUNCATED | ... */
export function decryptStream(password) {
  let buf = Buffer.alloc(0);
  let header = null;
  let prefix = null;
  let key = null;
  let counter = 0;
  let sawFinal = false;

  return new Transform({
    async transform(chunk, _enc, cb) {
      try {
        if (sawFinal) throw new PackError("PACK_CORRUPT", "بيانات زائدة بعد نهاية الحزمة.");
        buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
        if (!header) {
          if (buf.length < HEADER_LEN) return cb();
          header = Buffer.from(buf.subarray(0, HEADER_LEN));
          buf = buf.subarray(HEADER_LEN);
          if (!header.subarray(0, 8).equals(MAGIC)) {
            throw new PackError("PACK_BAD_MAGIC", "الملف ليس حزمة رصد صالحة.");
          }
          const logN = header[8];
          if (logN < MIN_LOG_N || logN > MAX_LOG_N) throw new PackError("PACK_BAD_PARAMS");
          prefix = header.subarray(25, 33);
          key = await deriveKey(password, header.subarray(9, 25), logN);
        }
        for (;;) {
          if (buf.length < 4) break;
          const lenField = buf.subarray(0, 4);
          const lf = lenField.readUInt32BE(0);
          const final = (lf & FINAL_BIT) !== 0;
          const len = lf & 0x7fffffff;
          if (len > CHUNK) throw new PackError("PACK_CORRUPT", "طول جزء غير صالح.");
          if (buf.length < 4 + len + TAG_LEN) break;
          const ct = buf.subarray(4, 4 + len);
          const tag = buf.subarray(4 + len, 4 + len + TAG_LEN);
          let plain;
          try {
            const d = createDecipheriv("aes-256-gcm", key, nonceFor(prefix, counter));
            d.setAAD(Buffer.concat([header, lenField]));
            d.setAuthTag(tag);
            plain = Buffer.concat([d.update(ct), d.final()]);
          } catch {
            // أول جزء: الأرجح كلمة مرور خاطئة. غيره: ملف تالف أو معدَّل.
            throw new PackError(
              counter === 0 ? "PACK_BAD_PASSWORD" : "PACK_CORRUPT",
              counter === 0 ? "كلمة المرور خاطئة أو الملف تالف." : "الملف تالف أو جرى تعديله.",
            );
          }
          counter++;
          buf = buf.subarray(4 + len + TAG_LEN);
          this.push(plain);
          if (final) {
            sawFinal = true;
            if (buf.length) throw new PackError("PACK_CORRUPT", "بيانات زائدة بعد نهاية الحزمة.");
            break;
          }
        }
        cb();
      } catch (e) {
        cb(e);
      }
    },
    flush(cb) {
      cb(sawFinal ? null : new PackError("PACK_TRUNCATED", "الملف ناقص (لم يكتمل تنزيله)."));
    },
  });
}

/** يتحقق من مسار نسبي بصيغة POSIX ويعيد أجزاءه، أو يرمي PACK_BAD_PATH. */
export function safeSegments(rel) {
  if (
    typeof rel !== "string" ||
    !rel ||
    rel.includes("\0") ||
    rel.includes("\\") ||
    rel.includes(":") ||
    rel.startsWith("/")
  ) {
    throw new PackError("PACK_BAD_PATH", `مسار غير مسموح: ${String(rel).slice(0, 80)}`);
  }
  const segs = rel.split("/");
  if (segs.some((s) => s === "" || s === "." || s === "..")) {
    throw new PackError("PACK_BAD_PATH", `مسار غير مسموح: ${rel.slice(0, 80)}`);
  }
  return segs;
}

/** files: [{rel, abs, size}] ← تيار سجلات: [u16 طول المسار][المسار][u64 الحجم][البيانات] ... ثم [0,0]. */
export function packFilesStream(files) {
  async function* gen() {
    for (const f of files) {
      safeSegments(f.rel);
      const p = Buffer.from(f.rel, "utf8");
      if (p.length > 65535) throw new PackError("PACK_BAD_PATH", "مسار أطول من المسموح.");
      const h = Buffer.alloc(2 + p.length + 8);
      h.writeUInt16BE(p.length, 0);
      p.copy(h, 2);
      h.writeBigUInt64BE(BigInt(f.size), 2 + p.length);
      yield h;
      let sent = 0;
      for await (const c of createReadStream(f.abs)) {
        sent += c.length;
        yield c;
      }
      if (sent !== f.size) throw new PackError("PACK_CHANGED", `تغيّر الملف أثناء التجميع: ${f.rel}`);
    }
    yield Buffer.from([0, 0]);
  }
  return Readable.from(gen(), { objectMode: false });
}

class ByteReader {
  constructor(iterable) {
    this.it = iterable[Symbol.asyncIterator]();
    this.buf = Buffer.alloc(0);
  }
  async take(n) {
    const parts = [];
    let have = 0;
    while (have < n) {
      if (this.buf.length === 0) {
        const { value, done } = await this.it.next();
        if (done) throw new PackError("PACK_TRUNCATED", "الحزمة ناقصة.");
        this.buf = Buffer.from(value);
      }
      const k = Math.min(n - have, this.buf.length);
      parts.push(this.buf.subarray(0, k));
      this.buf = this.buf.subarray(k);
      have += k;
    }
    return parts.length === 1 ? parts[0] : Buffer.concat(parts);
  }
  /** يستهلك ما تبقى كي تُنفَّذ فحوص النهاية (وسم الجزء الأخير، CRC لـ gzip). */
  async drain() {
    for (;;) {
      const { done } = await this.it.next();
      if (done) return;
    }
  }
}

/** يفك سجلات الحزمة إلى مجلد فارغ. يرفض المسارات الخطرة والملفات المكررة. */
export async function unpackTo(readable, dest, { maxFiles = 500_000, maxBytes = 4 * 2 ** 30 } = {}) {
  const root = path.resolve(dest);
  const rd = new ByteReader(readable);
  let files = 0;
  let total = 0;
  for (;;) {
    const pl = (await rd.take(2)).readUInt16BE(0);
    if (pl === 0) break;
    const rel = (await rd.take(pl)).toString("utf8");
    const size = Number((await rd.take(8)).readBigUInt64BE());
    const segs = safeSegments(rel);
    if (!Number.isSafeInteger(size) || ++files > maxFiles || (total += size) > maxBytes) {
      throw new PackError("PACK_TOO_LARGE", "الحزمة أكبر من المسموح.");
    }
    const target = path.join(root, ...segs);
    if (!target.startsWith(root + path.sep)) throw new PackError("PACK_BAD_PATH", rel);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const fh = await open(target, "wx", 0o600);
    try {
      let left = size;
      while (left > 0) {
        const n = Math.min(left, CHUNK);
        await fh.write(await rd.take(n));
        left -= n;
      }
    } finally {
      await fh.close();
    }
  }
  await rd.drain();
  return { files, bytes: total };
}
