"""محرك التدقيق الديناميكي: يقرأ كل الأرقام والملاحظات من ملف Excel الفعلي، بلا قيم ثابتة.

ورقة كل جدول تُسمّى بمفتاحه (مثل Direct_Purchases_Orders) وعناوين أعمدتها بالعربية كما يصدّرها النظام.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field

import pandas as pd

from conflict import describe, level_of, party, score_match

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "datasets.json"), encoding="utf-8") as fh:
    SECTORS = json.load(fh)["sectors"]

DATASETS = {d["key"]: {**d, "sector": s["key"], "sector_label": s["label"]} for s in SECTORS for d in s["datasets"]}
SEV_ORDER = {"high": 0, "medium": 1, "low": 2}
SEV_LABEL = {"high": "مرتفعة", "medium": "متوسطة", "low": "منخفضة"}

# السند القانوني: أسماء الصكوك دون أرقام مواد (تُستكمل من النسخة المعتمدة)
LEGAL = {
    "procurement": "نظام المشتريات الحكومية رقم (8) لسنة 2022 وتعليمات تنظيم إجراءات المشتريات الحكومية لسنة 2022",
    "finance": "النظام المالي للبلديات رقم (142) لسنة 2016 وتعديلاته",
    "hr": "نظام موظفي البلديات المعمول به ونظام الخدمة المدنية فيما لم يرد فيه نص",
    "fleet": "التعليمات الناظمة لاستخدام مركبات الجهات العامة وصرف المحروقات المعمول بها",
    "warehouses": "التعليمات الناظمة للمستودعات واللوازم والجرد والشطب في البلديات",
    "advances": "النظام المالي للبلديات رقم (142) لسنة 2016 وتعديلاته (السلف)",
    "tenders": "نظام المشتريات الحكومية رقم (8) لسنة 2022 ووثائق العقد والشروط العامة",
    "conflict": "قانون النزاهة ومكافحة الفساد رقم (13) لسنة 2016 وتعديلاته",
}


def legal_article(rule_id: str) -> str:
    """رقم المادة من src/rasd/legal-articles.json (مشترك مع الواجهة). فارغ => تُستكمل من النسخة المعتمدة."""
    try:
        with open(os.path.join(HERE, "..", "src", "rasd", "legal-articles.json"), encoding="utf-8") as fh:
            return (json.load(fh).get("rules", {}).get(rule_id, {}).get("articles") or "").strip()
    except (OSError, ValueError):
        return ""


@dataclass
class Finding:
    dataset: str
    row: int
    severity: str
    test: str
    detail: str
    amount: float = 0.0
    legal: str = ""
    status: str = "جديدة"
    final: str = ""
    confidence: float | None = None  # درجة الثقة (0..1) لمؤشرات تضارب المصالح

    @property
    def sector(self) -> str:
        return DATASETS[self.dataset]["sector"]


def _num(v):
    try:
        s = str(v).replace(",", "").strip()
        return float(s) if s not in ("", "nan", "None") else None
    except ValueError:
        return None


def to_date(v):
    """تحويل تاريخ إلى Timestamp. يدعم الرقم التسلسلي لـ Excel (مثل 46315) إضافة إلى النصوص."""
    if v is None:
        return pd.NaT
    s = str(v).strip()
    if re.fullmatch(r"\d{5}(\.\d+)?", s) and 20000 <= float(s) <= 80000:
        return pd.to_datetime(float(s), unit="D", origin="1899-12-30")
    return pd.to_datetime(v, errors="coerce")


def _blank(v) -> bool:
    return v is None or (isinstance(v, float) and pd.isna(v)) or str(v).strip() in ("", "nan", "None")


def _norm(s) -> str:
    s = re.sub(r"[\u064B-\u0652\u0640]", "", str(s or "")).strip().lower()
    return re.sub(r"\s+", " ", s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ة", "ه").replace("ى", "ي"))


def _full(s) -> str:
    n = _norm(s)
    return n if len(n.split()) >= 2 else ""


def load_store(source) -> dict[str, pd.DataFrame]:
    """يقرأ ملف Excel ويعيد DataFrame لكل جدول معروف، بأعمدة مفاتيح الحقول."""
    xl = pd.ExcelFile(source)
    store = {}
    for sheet in xl.sheet_names:
        key = next((k for k in DATASETS if k[:31] == sheet), None)
        if not key:
            continue
        df = xl.parse(sheet, dtype=object)
        by_label = {f["label"]: f["key"] for f in DATASETS[key]["fields"]}
        valid = {f["key"] for f in DATASETS[key]["fields"]}
        df = df.rename(columns={c: by_label.get(str(c).strip(), c) for c in df.columns})
        store[key] = df[[c for c in df.columns if c in valid]].reset_index(drop=True)
    return store


def _rows(store, key):
    df = store.get(key)
    return [] if df is None else df.to_dict("records")


def run_audit(store: dict[str, pd.DataFrame], params: dict | None = None, today: pd.Timestamp | None = None) -> list[Finding]:
    p = {"ceiling": 0.0, "split_days": 7, "concentration_pct": 25.0, "aging_days": 365, **(params or {})}
    today = today or pd.Timestamp.today().normalize()
    out: list[Finding] = []

    def add(ds, i, sev, test, detail, amount=0.0):
        out.append(Finding(ds, i, sev, test, detail, abs(amount or 0.0), LEGAL.get(DATASETS[ds]["sector"], "")))

    # 1) الحقول الجوهرية الناقصة (تُرفض/تُرصد فوراً)
    for key, d in DATASETS.items():
        labels = {f["key"]: f["label"] for f in d["fields"]}
        for i, r in enumerate(_rows(store, key)):
            miss = [labels[k] for k in d["required"] if _blank(r.get(k))]
            if miss:
                add(key, i, "medium", "حقل جوهري ناقص", "لم يُدخل: " + "، ".join(miss))

    # 2) تكرار المعرّفات
    for key, d in DATASETS.items():
        idk = d["fields"][0]["key"]
        seen: dict[str, int] = {}
        for i, r in enumerate(_rows(store, key)):
            v = _norm(r.get(idk))
            if v:
                if v in seen:
                    add(key, i, "high", "تكرار معرّف السجل", f"{r.get(idk)} مكرر مع السجل {seen[v] + 1}")
                seen[v] = i

    # 3) المشتريات المباشرة: تجزئة/سقف/تركّز/مورد = موظف
    dp = [(i, r, _num(r.get("value")) or 0.0, to_date(r.get("date"))) for i, r in enumerate(_rows(store, "Direct_Purchases_Orders"))]
    dp = [x for x in dp if pd.notna(x[3]) and _norm(x[1].get("supplier"))]
    by_sup: dict[str, list] = {}
    for x in dp:
        by_sup.setdefault(_norm(x[1]["supplier"]), []).append(x)
    total_all = sum(x[2] for x in dp) or 0.0
    for sup, lst in by_sup.items():
        lst.sort(key=lambda x: x[3])
        flagged = set()
        for a in lst:
            win = [x for x in lst if 0 <= (x[3] - a[3]).days <= p["split_days"]]
            if len(win) >= 2:
                s = sum(x[2] for x in win)
                if (p["ceiling"] > 0 and s > p["ceiling"] and all(x[2] <= p["ceiling"] for x in win)) or (p["ceiling"] <= 0 and len(win) >= 3):
                    flagged.update(x[0] for x in win)
        for x in lst:
            if x[0] in flagged:
                add("Direct_Purchases_Orders", x[0], "high", "تجزئة أوامر شراء لمورد ضمن فترة متقاربة", f"{x[1]['supplier']} — {x[2]:,.2f}", x[2])
        s = sum(x[2] for x in lst)
        if p["ceiling"] > 0 and s > p["ceiling"]:
            add("Direct_Purchases_Orders", lst[0][0], "high", "تجاوز السقف التراكمي للشراء المباشر لمورد", f"{lst[0][1]['supplier']} — إجمالي {s:,.2f} مقابل سقف {p['ceiling']:,.2f}", s - p["ceiling"])
        elif p["ceiling"] <= 0 and total_all and len(lst) >= 3 and s / total_all * 100 >= p["concentration_pct"]:
            add("Direct_Purchases_Orders", lst[0][0], "medium", "تركّز المشتريات المباشرة على مورد واحد", f"{lst[0][1]['supplier']} — {s / total_all * 100:.0f}% من إجمالي المشتريات", s)
    # تضارب المصالح: مطابقة كل مورد/جهة محال عليها مع الموظفين وعمال المياومة بدرجة ثقة (conflict.py)
    staff = [
        ("كشوفات الرواتب", r.get("name"), party(r.get("name"), r.get("national_id"), r.get("bank_account"), r.get("phone"), r.get("address")), r.get("employee_no") or r.get("national_id"))
        for r in _rows(store, "HR_Payroll_Sheets")
    ] + [
        ("المياومة", r.get("name"), party(r.get("name"), r.get("id_no"), r.get("bank_account"), r.get("phone"), r.get("address")), r.get("id_no"))
        for r in _rows(store, "HR_Daily_Wagers")
    ]
    sources = [
        ("Direct_Purchases_Orders", "supplier", "supplier_national_id", "supplier_bank", "supplier_phone", "supplier_address", "value"),
        ("Tenders_Records", "winner", "winner_national_id", "winner_bank", "winner_phone", "winner_address", "awarded_value"),
        ("Warehouses_Inbound_Vouchers", "supplier", None, None, None, None, None),
    ]
    for ds, c_name, c_nid, c_acct, c_phone, c_addr, c_amt in sources:
        for i, r in enumerate(_rows(store, ds)):
            sup = party(r.get(c_name), r.get(c_nid) if c_nid else None, r.get(c_acct) if c_acct else None, r.get(c_phone) if c_phone else None, r.get(c_addr) if c_addr else None)
            for src, name, keys, ident in staff:
                m = score_match(sup, keys)
                if not m:
                    continue
                who = f"{r.get(c_name)} ↔ {name} ({src}{' ' + str(ident) if not _blank(ident) else ''})"
                test, detail = describe(who, m)
                add(ds, i, m["level"], test, detail, (_num(r.get(c_amt)) or 0) if c_amt else 0)
                out[-1].confidence = m["confidence"]
    for i, r in enumerate(_rows(store, "Direct_Purchases_Orders")):
        sup = _full(r.get("supplier"))
        if sup and sup in {_full(r.get("approver")), _full(r.get("entered_by")), _full(r.get("received_by"))} - {""}:
            add("Direct_Purchases_Orders", i, "high", "تعارض مصالح: المورد هو المعتمِد/المُدخل/المستلم", str(r.get("supplier")), _num(r.get("value")) or 0)

    # 4) لجان العطاءات: عضو = الفائز، وتكرار الأعضاء
    tenders = _rows(store, "Tenders_Records")
    members = [[m for m in map(_norm, re.split(r"[،,;؛/\n]|\sو\s|\s-\s", str(r.get("committee") or ""))) if len(m.split()) >= 2] for r in tenders]
    counts: dict[str, int] = {}
    for ms in members:
        for m in set(ms):
            counts[m] = counts.get(m, 0) + 1
    for i, (r, ms) in enumerate(zip(tenders, members)):
        win = _full(r.get("winner"))
        if win and any(m == win or m in win or win in m for m in ms):
            add("Tenders_Records", i, "high", "تعارض مصالح: عضو لجنة العطاءات هو الجهة المحال عليها", str(r.get("winner")), _num(r.get("awarded_value")) or 0)
        rep = [m for m in set(ms) if counts[m] >= 3]
        if rep:
            add("Tenders_Records", i, "medium", "تكرار أعضاء لجان العطاءات دون تدوير", "، ".join(rep))

    # 5) تقادم الذمم
    def aging(ds, i, who, amt, since, label):
        if amt and amt > 0 and pd.notna(since):
            days = (today - since).days
            if days > 90:
                sev = "high" if days > p["aging_days"] else "medium" if days > 180 else "low"
                add(ds, i, sev, "تقادم ذمة إيراد", f"{label}: {who} — {amt:,.2f} متأخرة {days} يوماً", amt)

    for i, r in enumerate(_rows(store, "Revenue_Profession_Licenses")):
        d = _num(r.get("fee_due"))
        if d is not None:
            aging("Revenue_Profession_Licenses", i, r.get("owner"), d - (_num(r.get("fee_paid")) or 0), to_date(r.get("date")), "رخص المهن")
    for i, r in enumerate(_rows(store, "Revenue_Municipal_Properties_Leases")):
        d = _num(r.get("installment"))
        if d is not None and _blank(r.get("paid_date")):
            aging("Revenue_Municipal_Properties_Leases", i, r.get("tenant"), d - (_num(r.get("paid_amount")) or 0), to_date(r.get("due_date")), "أملاك مؤجرة")
    for i, r in enumerate(_rows(store, "Revenue_Daily_Fees")):
        d = _num(r.get("amount_due"))
        if d is not None:
            aging("Revenue_Daily_Fees", i, r.get("collector"), d - (_num(r.get("amount_collected")) or 0), to_date(r.get("date")), "رسوم يومية")

    # 6) فصل الصلاحيات في سندات الصرف
    for i, r in enumerate(_rows(store, "Payment_Vouchers")):
        a, b = _full(r.get("approved_by")), _full(r.get("entered_by"))
        if a and a == b:
            add("Payment_Vouchers", i, "high", "فصل الصلاحيات: المُدخل هو المعتمِد", str(r.get("entered_by")), _num(r.get("amount")) or 0)

    for f in out:
        f.final = f.severity
    out.sort(key=lambda f: (SEV_ORDER[f.final], f.dataset, f.row))
    return out


def summarize(store, findings) -> dict:
    """كل مؤشرات الخلاصة التنفيذية محسوبة من البيانات."""
    total = sum(len(df) for df in store.values())
    affected = len({(f.dataset, f.row) for f in findings})
    per_sector = {}
    for s in SECTORS:
        keys = {d["key"] for d in s["datasets"]}
        rows = sum(len(store[k]) for k in keys if k in store)
        aff = len({(f.dataset, f.row) for f in findings if f.dataset in keys})
        per_sector[s["label"]] = {
            "rows": rows,
            "findings": sum(1 for f in findings if f.dataset in keys),
            "compliance": None if not rows else round((1 - min(aff, rows) / rows) * 100),
        }
    return {
        "activities_with_data": sum(1 for v in per_sector.values() if v["rows"]),
        "activities_total": len(SECTORS),
        "high": sum(1 for f in findings if f.final == "high"),
        "medium": sum(1 for f in findings if f.final == "medium"),
        "low": sum(1 for f in findings if f.final == "low"),
        "compliance": None if not total else round((1 - min(affected, total) / total) * 100),
        "records": total,
        "per_sector": per_sector,
    }


def findings_frame(findings) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "النشاط": DATASETS[f.dataset]["sector_label"],
                "الجدول": DATASETS[f.dataset]["label"],
                "رقم السجل": f.row + 1,
                "الاختبار": f.test,
                "التفاصيل": f.detail,
                "درجة الثقة": None if f.confidence is None else f"{round(f.confidence * 100)}%",
                "المخاطر": SEV_LABEL[f.final],
                "الأثر المالي": f.amount or None,
                "السند القانوني": f.legal + " — المادة (…) تُستكمل من النسخة المعتمدة",
            }
            for f in findings
        ]
    )
