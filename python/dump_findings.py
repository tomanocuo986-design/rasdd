"""يشغّل محرك Python على مخزن بيانات JSON ويطبع عدد الملاحظات لكل اختبار.

يُستدعى من src/test/engine-parity.test.ts (اختبار التكافؤ بين المحركين):
    echo '{"today":"2026-11-01","store":{...}}' | python3 python/dump_findings.py
المدخل: {"today": "YYYY-MM-DD", "params": {...اختياري، بمفاتيح Python...}, "store": {مفتاح_الجدول: [سجلات]}}
المخرج: {"counts": {اسم الاختبار: العدد}, "total": N, "byDataset": {اسم الاختبار: {الجدول: العدد}}}
"""
import json
import os
import sys
from collections import Counter, defaultdict

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audit_engine as eng  # noqa: E402


def main() -> None:
    payload = json.load(sys.stdin)
    store = {k: pd.DataFrame(v, dtype=object) for k, v in payload["store"].items() if v}
    findings = eng.run_audit(store, payload.get("params") or {}, pd.Timestamp(payload["today"]))
    counts = Counter(f.test for f in findings)
    by_dataset: dict[str, Counter] = defaultdict(Counter)
    for f in findings:
        by_dataset[f.test][f.dataset] += 1
    json.dump(
        {"counts": counts, "total": len(findings), "byDataset": {t: dict(c) for t, c in by_dataset.items()}},
        sys.stdout,
        ensure_ascii=False,
    )


if __name__ == "__main__":
    main()
