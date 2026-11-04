"""تكرار المعرّف يُطلق فقط على الجداول ذات المعرّف الفريد، لا على رقم الآلية أو الحساب البنكي."""
import pandas as pd

import audit_engine as eng

TODAY = pd.Timestamp("2026-11-01")
TEST = "تكرار معرّف السجل"


def run(store):
    return [f for f in eng.run_audit(store, {}, TODAY) if f.test == TEST]


def test_flags_duplicate_license_numbers():
    store = {"Revenue_Profession_Licenses": pd.DataFrame([{"license_no": "L-1", "owner": "أ", "fee_due": "10"}, {"license_no": "L-1", "owner": "ب", "fee_due": "20"}], dtype=object)}
    assert len(run(store)) == 1


def test_does_not_flag_repeated_vehicle_in_maintenance():
    store = {"Fleet_Maintenance": pd.DataFrame([{"vehicle": "12-3456", "date": "2026-01-01"}, {"vehicle": "12-3456", "date": "2026-03-01"}], dtype=object)}
    assert run(store) == []


def test_does_not_flag_same_bank_account_reconciled_monthly():
    store = {"Bank_Reconciliations": pd.DataFrame([{"bank_account": "1001-554", "statement_date": "2026-01-31"}, {"bank_account": "1001-554", "statement_date": "2026-02-28"}], dtype=object)}
    assert run(store) == []


def test_does_not_flag_employee_repeated_across_periods():
    store = {"HR_Overtime_Bonuses": pd.DataFrame([{"employee_no": "E-1", "name": "س", "period": "2026-01"}, {"employee_no": "E-1", "name": "س", "period": "2026-02"}], dtype=object)}
    assert run(store) == []


def test_every_listed_dataset_exists():
    assert eng.UNIQUE_ID_DATASETS <= set(eng.DATASETS)
