"""اختبار مطابقة تضارب المصالح ودرجة الثقة. التشغيل: python -m pytest python/test_conflict.py"""
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))
from audit_engine import run_audit  # noqa: E402
from conflict import national_id_key, party, score_match  # noqa: E402


def test_national_id_normalisation():
    assert national_id_key("٩٩٠٠٠٠٠١٣٧") == "9900000137"
    assert national_id_key(9900000137.0) == "9900000137"
    assert national_id_key("9900 000-137") == "9900000137"
    assert national_id_key("E-100") == ""
    assert national_id_key("12345") == ""
    assert national_id_key(float("nan")) == ""


def test_scores_match_js_engine():
    nid = score_match(party(nid="9900000137"), party(nid="9900000137"))
    assert nid["confidence"] == 0.95 and nid["level"] == "high"
    assert score_match(party(phone="0791234567"), party(phone="0791234567"))["confidence"] == 0.7
    assert score_match(party(name="محمد أحمد"), party(name="محمد أحمد"))["level"] == "medium"
    assert score_match(party(phone="0791234567"), party(phone="0799999999")) is None


def test_different_national_ids_lower_confidence():
    assert score_match(party(name="محمد أحمد", nid="9900000111"), party(name="محمد أحمد", nid="9900000222")) is None
    m = score_match(party(phone="0791234567", nid="9900000111"), party(phone="0791234567", nid="9900000222"))
    assert m["conflicting_nid"] and m["confidence"] < 0.4
    assert score_match(party(phone="0791234567", nid="9900000111"), party(phone="0791234567"))["confidence"] == 0.7


def _audit(po, payroll=None, wagers=None, tenders=None):
    store = {"Direct_Purchases_Orders": pd.DataFrame(po)}
    if payroll:
        store["HR_Payroll_Sheets"] = pd.DataFrame(payroll)
    if wagers:
        store["HR_Daily_Wagers"] = pd.DataFrame(wagers)
    if tenders:
        store["Tenders_Records"] = pd.DataFrame(tenders)
    return [f for f in run_audit(store, today=pd.Timestamp("2026-11-01")) if "بين مورد وموظف" in f.test]


def test_supplier_national_id_matches_payroll():
    f = _audit(
        [{"po_no": "1", "date": "2026-10-01", "supplier": "مؤسسة الندى", "value": "100", "supplier_national_id": 9900000137}],
        payroll=[{"employee_no": "E-1", "name": "سلمى العمري", "national_id": "9900000137"}],
    )
    assert len(f) == 1
    assert f[0].final == "high" and f[0].confidence == 0.95
    assert "تطابق الرقم الوطني" in f[0].test and "درجة الثقة 95%" in f[0].detail


def test_tender_winner_matches_wager_national_id():
    f = _audit(
        [{"po_no": "1", "date": "2026-10-01", "supplier": "س", "value": "1"}],
        wagers=[{"id_no": "9800000001", "name": "علي حسن", "period": "2026-10"}],
        tenders=[{"tender_no": "T1", "date": "2026-10-01", "winner": "مقاول فردي", "winner_national_id": "9800000001", "awarded_value": "5000"}],
    )
    assert [x.dataset for x in f] == ["Tenders_Records"]
    assert f[0].amount == 5000


def test_same_name_different_national_id_not_reported():
    f = _audit(
        [{"po_no": "1", "date": "2026-10-01", "supplier": "محمد أحمد", "value": "1", "supplier_national_id": "9900000111"}],
        payroll=[{"employee_no": "E-1", "name": "محمد أحمد", "national_id": "9900000222"}],
    )
    assert f == []
