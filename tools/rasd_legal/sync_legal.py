"""
python sync_legal.py            # مزامنة كل المصادر في sources.json
جدولة أسبوعية: cron (0 3 * * 0)  أو Render Cron Job
تفعيل OCR للملفات الرديئة:  RASD_OCR=1 python sync_legal.py
"""
import json
import sys
from legal_lib import (open_db, fetch, extract_links, extract_text, store_document,
                       discover_list_pages, documents_needing_review)


def main(config="sources.json", db_path="legal.db"):
    db = open_db(db_path)
    sources = json.load(open(config, encoding="utf-8"))
    stats = {"new": 0, "updated": 0, "unchanged": 0, "failed": 0}

    for src in sources:
        name = src["name"]
        pages = list(src.get("index_pages", []))
        items = [(f.get("title", f["url"]), f["url"]) for f in src.get("direct_files", [])]

        # اكتشاف صفحات التشريعات من الصفحة الرئيسية (للمواقع التي لم تُعرف روابط فهارسها)
        if src.get("home") and src.get("discover", False):
            try:
                html, _ = fetch(src["home"])
                found = discover_list_pages(html, src["home"])
                print(f"[اكتشاف] {name}: {len(found)} صفحة قائمة -> {list(found.values())}")
                pages += [u for u in found if u not in pages]
            except Exception as e:
                print(f"[فشل اكتشاف] {name}: {e}")
                stats["failed"] += 1

        for p in pages:
            try:
                html, _ = fetch(p)
                links = extract_links(html, p)
                print(f"[قائمة] {name} | {p} -> {len(links)} ملف PDF")  # إن كان 0 فقد تكون الصفحة مقسمة أو بدون روابط مباشرة
                items += links
            except Exception as e:
                print(f"[فشل قائمة] {name} {p}: {e}")
                stats["failed"] += 1

        for title, url in {u: (t, u) for t, u in items}.values():
            try:
                raw, ctype = fetch(url)
                text, flags = extract_text(raw, ctype, url)
                status = store_document(db, name, title, url, text, raw, flags)
                stats[status] += 1
                print(f"[{status}] {name} | {title}")
            except Exception as e:
                print(f"[فشل] {name} | {url}: {e}")
                stats["failed"] += 1

    print("الملخص:", stats)
    bad = documents_needing_review(db)
    if bad:
        print(f"\n⚠ {len(bad)} وثيقة تحتاج مراجعة/OCR (نصها مشوّه ومستبعد من البحث):")
        for d in bad:
            print(f"  - {d['source']} | {d['title']} | {d['quality_flags']}")


if __name__ == "__main__":
    main(*sys.argv[1:])
