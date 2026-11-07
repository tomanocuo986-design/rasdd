"""اختبار تحويل التواريخ التسلسلية لـ Excel. التشغيل: python -m pytest python/test_dates.py"""
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from audit_engine import to_date  # noqa: E402


def test_serial_to_date():
    assert to_date(46323) == pd.Timestamp("2026-10-28")
    assert to_date("45667") == pd.Timestamp("2025-01-10")


def test_text_dates_and_garbage():
    assert to_date("2026-10-28") == pd.Timestamp("2026-10-28")
    assert pd.isna(to_date("غير مفهوم"))
    assert pd.isna(to_date(None))


def test_difference_in_days():
    # 46331 = 2026-11-05 ، وبين 2026-10-28 و2026-11-05 ثمانية أيام
    assert (to_date(46331) - to_date("2026-10-28")).days == 8
