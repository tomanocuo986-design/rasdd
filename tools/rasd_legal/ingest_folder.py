"""
فهرسة ملفات محلية بدون إنترنت (PDF / HTML / TXT) في legal.db بنفس طريقة المزامنة.

الاستخدام:
    python ingest_folder.py ./legislation_files
    python ingest_folder.py ./legislation_files legal.db

تنظيم المجلد (اختياري): كل مجلد فرعي يُعامل كاسم جهة المصدر، مثلاً:
    legislation_files/وزارة المالية/النظام_المالي.pdf
    legislation_files/دائرة العطاءات الحكومية/نظام_المشتريات.pdf
الملفات الموضوعة مباشرة في المجلد الأعلى تُسجَّل بمصدر "ملفات محلية".
إعادة التشغيل آمنة: الملف غير المتغيّر يُتجاهل، والمتغيّر يُحفظ كإصدار جديد.
"""
import os
import sys
from pathlib import Path

from legal_lib import open_db, extract_text, store_document, clean_extracted, documents_needing_review

EXTS = {".pdf", ".html", ".htm", ".txt"}


def read_file(path: Path):
    raw = path.read_bytes()
    ext = path.suffix.lower()
    if ext == ".txt":
        for enc in ("utf-8-sig", "cp1256", "utf-16"):  # cp1256 = ترميز عربي شائع في الملفات القديمة
            try:
                return clean_extracted(raw.decode(enc)), [], raw
            except (UnicodeDecodeError, UnicodeError):
                continue
        raise ValueError("ترميز النص غير معروف")
    ctype = "application/pdf" if ext == ".pdf" else "text/html"
    text, flags = extract_text(raw, ctype, path.name)
    return text, flags, raw


def main(folder, db_path="legal.db"):
    root = Path(folder)
    if not root.is_dir():
        sys.exit(f"المجلد غير موجود: {folder}")
    db = open_db(db_path)
    stats = {"new": 0, "updated": 0, "unchanged": 0, "failed": 0}

    for path in sorted(p for p in root.rglob("*") if p.suffix.lower() in EXTS):
        rel = path.relative_to(root)
        source = rel.parts[0] if len(rel.parts) > 1 else "ملفات محلية"
        title = path.stem.replace("_", " ")
        try:
            text, flags, raw = read_file(path)
            status = store_document(db, source, title, path.resolve().as_uri(), text, raw, flags)
            stats[status] += 1
            print(f"[{status}] {source} | {title}")
        except Exception as e:
            stats["failed"] += 1
            print(f"[فشل] {rel}: {e}")

    print("الملخص:", stats)
    bad = documents_needing_review(db)
    if bad:
        print(f"\n⚠ {len(bad)} وثيقة نصها مشوّه ومستبعدة من البحث (جرّب RASD_OCR=1):")
        for d in bad:
            print(f"  - {d['source']} | {d['title']} | {d['quality_flags']}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(*sys.argv[1:3])
