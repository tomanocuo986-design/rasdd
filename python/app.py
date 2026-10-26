import os

import pandas as pd
import streamlit as st

import audit_engine as eng

st.set_page_config(page_title="سند | وكيل التدقيق الذكي الشامل", page_icon="🏛️", layout="wide")
st.title("🏛️ منصة سند للتدقيق المبني على المخاطر")
st.markdown("نظام محلي (Offline): كل الأرقام والملاحظات تُحسب مباشرة من ملف Excel المرفوع، ولا توجد قيم ثابتة.")

st.sidebar.header("📁 ملفات وإعدادات التدقيق")
uploaded = st.sidebar.file_uploader("ملف Excel الشامل (ورقة لكل جدول بمفتاحه)", type=["xlsx"])
default_path = "comprehensive_audit_template_v11.xlsx"
active = uploaded if uploaded is not None else (default_path if os.path.exists(default_path) else None)
if uploaded is not None:
    st.sidebar.success("✅ تم رفع الملف.")
elif active:
    st.sidebar.info("📂 يُستخدم الملف الافتراضي المحلي.")

st.sidebar.subheader("معاملات الفحص")
params = {
    "ceiling": st.sidebar.number_input("سقف الشراء المباشر السنوي لكل مورد (0 = غير مفعل)", min_value=0.0, value=0.0),
    "split_days": st.sidebar.number_input("نافذة كشف التجزئة (يوم)", min_value=1, value=7),
    "concentration_pct": st.sidebar.number_input("نسبة التركّز على مورد (%)", min_value=1.0, value=25.0),
    "aging_days": st.sidebar.number_input("حد تقادم الذمة (يوم)", min_value=30, value=365),
}

if active is None:
    st.warning("⚠️ ارفع ملف Excel أو ضع الملف الافتراضي في المجلد المحلي.")
    st.stop()

try:
    store = eng.load_store(active)
except Exception as e:  # noqa: BLE001
    st.error(f"تعذّرت قراءة ملف Excel: {e}")
    st.stop()

if not store:
    st.warning("لم يُعثر على أي ورقة باسم جدول معروف. تأكد أن أسماء الأوراق هي مفاتيح الجداول (مثل Direct_Purchases_Orders).")
    st.stop()

findings = eng.run_audit(store, params)
summary = eng.summarize(store, findings)

tab1, tab2, tab3, tab4 = st.tabs(["📊 استعراض الجداول", "🚀 محرك الفحص", "📋 الملاحظات الرقابية", "📈 الخلاصة التنفيذية"])

with tab1:
    sheet = st.selectbox("الجدول:", list(store))
    st.write(f"عدد السجلات: {len(store[sheet])}")
    st.dataframe(store[sheet], use_container_width=True)

with tab2:
    sectors = {s["label"]: s["key"] for s in eng.SECTORS}
    pick = st.selectbox("النشاط:", ["الكل"] + list(sectors))
    shown = [f for f in findings if pick == "الكل" or f.sector == sectors[pick]]
    st.write(f"عدد الملاحظات: {len(shown)}")
    if shown:
        st.dataframe(eng.findings_frame(shown), use_container_width=True)
    else:
        st.success("لا ملاحظات على السجلات الحالية.")

with tab3:
    if not findings:
        st.info("لا توجد ملاحظات رقابية.")
    groups: dict = {}
    for f in findings:
        groups.setdefault((f.dataset, f.test), []).append(f)
    for (ds, test), fs in groups.items():
        icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}[fs[0].final]
        with st.expander(f"{icon} [{eng.SEV_LABEL[fs[0].final]}] {eng.DATASETS[ds]['label']}: {test} ({len(fs)})"):
            st.markdown(f"* **السند / التشريع:** {fs[0].legal} — المادة (…) تُستكمل من النسخة المعتمدة")
            for f in fs[:10]:
                st.markdown(f"* السجل {f.row + 1}: {f.detail}")
            if len(fs) > 10:
                st.caption(f"… و{len(fs) - 10} سجل آخر")

with tab4:
    c = st.columns(4)
    c[0].metric("الأنشطة التي لها بيانات", f"{summary['activities_with_data']} / {summary['activities_total']}")
    c[1].metric("ملاحظات عالية المخاطر", summary["high"])
    c[2].metric("ملاحظات متوسطة", summary["medium"])
    c[3].metric("نسبة الالتزام العام", "—" if summary["compliance"] is None else f"{summary['compliance']}%")
    st.markdown("---")
    st.dataframe(
        pd.DataFrame([{"النشاط": k, "السجلات": v["rows"], "الملاحظات": v["findings"], "الالتزام %": v["compliance"]} for k, v in summary["per_sector"].items()]),
        use_container_width=True,
    )
    if findings:
        st.download_button("تنزيل نتائج التدقيق (CSV)", eng.findings_frame(findings).to_csv(index=False).encode("utf-8-sig"), "audit-findings.csv")
