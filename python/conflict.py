"""مطابقة تضارب المصالح (مورد/جهة محال عليها ↔ موظف أو عامل مياومة) مع درجة الثقة.

يقابل src/rasd/conflict-match.js، ويقرأ الأوزان نفسها من src/rasd/conflict-config.json كي لا يختلف المحركان.
الثقة = 1 − ∏(1 − وزن كل مؤشر متطابق)؛ وإن كان للطرفين رقمان وطنيان مختلفان فهما شخصان مختلفان على الأرجح فتُخفَّض الثقة.
"""
from __future__ import annotations

import json
import os
import re

_HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_HERE, "..", "src", "rasd", "conflict-config.json"), encoding="utf-8") as _fh:
    CONFIG = json.load(_fh)

_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")

SIGNAL_LABEL = {"nid": "الرقم الوطني", "acct": "الحساب البنكي", "phone": "رقم الهاتف", "addr": "العنوان", "name": "الاسم"}
SINGLE_TEST = {
    "nid": "تطابق الرقم الوطني بين مورد وموظف",
    "acct": "تطابق حساب بنكي بين مورد وموظف",
    "phone": "تطابق رقم هاتف بين مورد وموظف",
    "addr": "تطابق عنوان بين مورد وموظف",
    "name": "تطابق اسم مورد مع اسم موظف",
}
MULTI_TEST = "تطابق متعدد المؤشرات بين مورد وموظف (شبهة تضارب مصالح)"
FRAUD_PREFIX = "مؤشر احتيال: "


def _txt(v) -> str:
    if v is None or (isinstance(v, float) and v != v):  # None أو NaN
        return ""
    s = str(v).strip()
    return "" if s in ("nan", "None", "NaT") else s


def name_key(s) -> str:
    t = re.sub(r"[ً-ْـ]", "", _txt(s)).lower()
    t = t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي")
    return re.sub(r"\s+", " ", t).strip()


def full_name_key(s) -> str:
    n = name_key(s)
    return n if len(n.split()) >= 2 else ""


def phone_key(s) -> str:
    d = re.sub(r"\D", "", _txt(s).translate(_DIGITS))
    return d[-9:] if len(d) >= 7 else ""


def acct_key(s) -> str:
    a = re.sub(r"[\s-]", "", _txt(s)).upper()
    return a if len(a) >= 6 else ""


def addr_key(s) -> str:
    a = re.sub(r"[^\w ]", "", name_key(s))
    return a if len(a) >= 10 else ""


def national_id_key(s) -> str:
    """أرقام فقط بطول 8–12 (الأردني 10). أي نص فيه حروف (مثل E-100) ليس رقماً وطنياً. يتحمل 9900000137.0 القادم من Excel."""
    t = re.sub(r"[\s-]", "", _txt(s).translate(_DIGITS))
    t = re.sub(r"\.0+$", "", t)
    n = CONFIG["national_id"]
    return t if t.isdigit() and n["min_length"] <= len(t) <= n["max_length"] else ""


def level_of(confidence: float) -> str:
    b = CONFIG["bands"]
    return "high" if confidence >= b["high"] else "medium" if confidence >= b["medium"] else "low"


def party(name=None, nid=None, acct=None, phone=None, addr=None) -> dict:
    """يبني مفاتيح موحدة لطرف من الأطراف."""
    return {
        "nm": full_name_key(name),
        "nid": national_id_key(nid),
        "acct": acct_key(acct),
        "phone": phone_key(phone),
        "addr": addr_key(addr),
    }


def score_match(a: dict, b: dict) -> dict | None:
    """يقارن طرفين؛ يُرجع None إن لم يتطابق شيء أو كانت الثقة أدنى من الحد، وإلا
    {signals, confidence, level, conflicting_nid}."""
    w, n = CONFIG["weights"], CONFIG["national_id"]
    parts: list[tuple[str, float]] = []
    if a["nid"] and a["nid"] == b["nid"]:
        parts.append(("nid", w["national_id"] * (1 if len(a["nid"]) == n["standard_length"] else n["nonstandard_factor"])))
    if a["acct"] and a["acct"] == b["acct"]:
        parts.append(("acct", w["account"]))
    if a["phone"] and a["phone"] == b["phone"]:
        parts.append(("phone", w["phone"]))
    if a["addr"] and a["addr"] == b["addr"]:
        parts.append(("addr", w["address"]))
    if a["nm"] and a["nm"] == b["nm"]:
        parts.append(("name", w["name"]))
    if not parts:
        return None

    miss = 1.0
    for _, x in parts:
        miss *= 1 - x
    confidence = 1 - miss
    conflicting = bool(a["nid"] and b["nid"] and a["nid"] != b["nid"])
    if conflicting:
        confidence *= CONFIG["conflicting_national_id_factor"]
    # round-half-up كما في JS (Math.round) لتطابق المحركين
    confidence = int(min(confidence, 0.99) * 100 + 0.5 + 1e-9) / 100
    if confidence < CONFIG["min_report"]:
        return None
    return {"signals": [s for s, _ in parts], "confidence": confidence, "level": level_of(confidence), "conflicting_nid": conflicting}


def describe(who: str, m: dict) -> tuple[str, str]:
    """(اسم الاختبار، التفاصيل) بالصياغة نفسها المستخدمة في الواجهة."""
    multi = len(m["signals"]) >= 2
    test = FRAUD_PREFIX + (MULTI_TEST if multi else SINGLE_TEST[m["signals"][0]])
    why = " — " + "، ".join(SIGNAL_LABEL[s] for s in m["signals"]) if multi else ""
    note = " — الرقمان الوطنيان مختلفان (غالباً شخصان مختلفان)" if m["conflicting_nid"] else ""
    return test, f"{who}{why}{note} — درجة الثقة {round(m['confidence'] * 100)}%"
