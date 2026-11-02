// @ts-nocheck
/* eslint-disable */
import { useMemo, useState } from "react";
import { buildLetters, lettersDocument, DEFAULT_ADDRESSEE, defaultLetterMeta } from "./letters";
import { CALIBRATION_PROFILES, calibrationFields, applyProfile, defaultCalibration } from "./severity";

const box = { border: "1px solid var(--border)", borderRadius: 8, padding: 14, margin: "16px 0", background: "var(--card)" };
const inp = { border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 12, width: "100%", background: "var(--background)" };
const lab = { fontSize: 11, display: "grid", gap: 3 };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 };

export function RejectedAlert({ message, rejectedLog, onDismiss, Button, onDownload }) {
  if (!message) return null;
  return (
    <div role="alert" style={{ border: "1px solid #dc2626", background: "color-mix(in srgb, #dc2626 10%, transparent)", color: "inherit", borderRadius: 8, padding: "10px 14px", margin: "0 0 14px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>تنبيه: سجلات مرفوضة لنقص حقول جوهرية</div>
      <div>{message}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {rejectedLog && <Button variant="outline" onClick={onDownload}>تنزيل السجلات المرفوضة (CSV)</Button>}
        <Button variant="outline" onClick={onDismiss}>إغلاق</Button>
      </div>
    </div>
  );
}

export function CalibrationPanel({ calibration, setCalibration }) {
  return (
    <section style={box} aria-label="معايرة الخطورة">
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>معايرة الخطورة النهائية</h3>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
        الخطورة النهائية = الأساسية + وزن التكرار من التقارير السابقة + وزن الأثر المالي. المعايرة ترفع ولا تخفض. الحدود الافتراضية تقديرية فراجعها.
      </p>
      <label style={{ ...lab, maxWidth: 280, marginBottom: 10 }}>
        طبيعة البلدية
        <select style={inp} value={calibration.profile} onChange={(e) => setCalibration(applyProfile(calibration, e.target.value))}>
          {Object.entries(CALIBRATION_PROFILES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </label>
      <div style={grid}>
        {calibrationFields.map((f) => (
          <label key={f.key} style={lab}>
            {f.label}
            <input type="number" min={f.min} step="any" style={inp} value={calibration[f.key]} onChange={(e) => setCalibration({ ...calibration, profile: f.key === "highImpact" || f.key === "mediumImpact" ? "custom" : calibration.profile, [f.key]: Math.max(f.min, Number(e.target.value) || 0) })} />
          </label>
        ))}
      </div>
      <button type="button" style={{ ...inp, width: "auto", marginTop: 10, cursor: "pointer" }} onClick={() => setCalibration(defaultCalibration)}>استعادة الافتراضي</button>
    </section>
  );
}

function download(name, html, mime) {
  const url = URL.createObjectURL(new Blob(["\ufeff", html], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
}

export function LettersPanel({ observations, findings, sectors, datasetLabel, Button }) {
  const [meta, setMeta] = useState(defaultLetterMeta);
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [addressees, setAddressees] = useState({});
  const letters = useMemo(
    () => buildLetters(observations, findings, sectors, { ...meta, addressees }, { approvedOnly, datasetLabel }),
    [observations, findings, sectors, meta, addressees, approvedOnly, datasetLabel],
  );
  const doc = () => lettersDocument(letters, `كتب رقابية - ${meta.municipality || "البلدية"}`);
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(doc());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };
  const set = (k) => (e) => setMeta({ ...meta, [k]: e.target.value });
  return (
    <section style={box} aria-label="الكتب الرقابية الرسمية">
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>الكتب والمراسلات الرقابية الرسمية</h3>
      <p style={{ fontSize: 11, color: "var(--muted-foreground)", margin: "0 0 10px" }}>
        كتاب لكل نشاط يتضمن الملاحظات بسندها القانوني وتفاصيلها الميدانية ومقارنتها بالتقارير السابقة.
      </p>
      <div style={grid}>
        <label style={lab}>البلدية<input style={inp} value={meta.municipality} onChange={set("municipality")} /></label>
        <label style={lab}>الجهة المُصدرة<input style={inp} value={meta.unit} onChange={set("unit")} /></label>
        <label style={lab}>رقم الكتاب<input style={inp} value={meta.refNo ?? ""} onChange={set("refNo")} /></label>
        <label style={lab}>اسم الموقّع<input style={inp} value={meta.signer} onChange={set("signer")} /></label>
        <label style={lab}>صفة الموقّع<input style={inp} value={meta.signerTitle} onChange={set("signerTitle")} /></label>
        <label style={lab}>نسخة إلى<input style={inp} value={meta.copyTo} onChange={set("copyTo")} /></label>
        <label style={lab}>مهلة الرد (أيام عمل)<input type="number" min="1" style={inp} value={meta.replyDays} onChange={(e) => setMeta({ ...meta, replyDays: Number(e.target.value) || 1 })} /></label>
      </div>
      <details style={{ marginTop: 10, fontSize: 12 }}>
        <summary>الجهة المخاطَبة لكل نشاط</summary>
        <div style={{ ...grid, marginTop: 8 }}>
          {sectors.map((s) => (
            <label key={s.key} style={lab}>{s.label}
              <input style={inp} value={addressees[s.key] ?? DEFAULT_ADDRESSEE[s.key] ?? ""} onChange={(e) => setAddressees({ ...addressees, [s.key]: e.target.value })} />
            </label>
          ))}
        </div>
      </details>
      <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", margin: "10px 0" }}>
        <input type="checkbox" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} />
        الملاحظات المعتمدة فقط (عند الإلغاء تُدرج المسودات بوسم «مسودة»)
      </label>
      {letters.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="ink" onClick={() => download("audit-letters.doc", doc(), "application/msword")}>تنزيل Word ({letters.length} كتاب)</Button>
          <Button variant="outline" onClick={() => download("audit-letters.html", doc(), "text/html")}>تنزيل HTML</Button>
          <Button variant="outline" onClick={print}>طباعة / حفظ PDF</Button>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>الأنشطة: {letters.map((l) => l.sectorLabel).join("، ")}</span>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>لا توجد ملاحظات {approvedOnly ? "معتمدة" : ""} لتصديرها. اعتمد الملاحظات من لوحة الملاحظات الرقابية أولاً.</p>
      )}
    </section>
  );
}
