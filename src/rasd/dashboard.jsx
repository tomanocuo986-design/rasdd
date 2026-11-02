// @ts-nocheck
/* eslint-disable */
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { complianceOf } from "./advanced";
import { agingSummary } from "./advanced-queries";

const COLORS = { high: "#dc2626", medium: "#ea580c", low: "#16a34a", ink: "#334155", new: "#2563eb", recurring: "#dc2626", resolved: "#16a34a" };
const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, minWidth: 0 };
const h4 = { fontSize: 13, fontWeight: 600, margin: "0 0 8px" };

/** نسبة الالتزام كبطاقة كبيرة مع لون بحسب المستوى. */
function Kpi({ label, value, hint, color }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color ?? "inherit", lineHeight: 1.3 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{hint}</div>}
    </div>
  );
}

const Empty = () => <p style={{ fontSize: 12, textAlign: "center", padding: 24, color: "var(--muted-foreground)" }}>لا توجد بيانات كافية بعد.</p>;

/**
 * لوحة المؤشرات التنفيذية. كل الأرقام تُحسب مباشرة من المخزن والملاحظات الحالية (useMemo)،
 * فتتغير الرسوم فور تعديل السجلات أو معاملات الفحص أو المعايرة.
 */
export function ExecutiveDashboard({ store, findings, sectors, resolved = [], historyStats, sectorLabel, today = Date.now() }) {
  const data = useMemo(() => {
    const comp = complianceOf(store, findings);
    const bySector = sectors.map((s) => {
      const keys = new Set(s.datasets.map((d) => d.key));
      const fs = findings.filter((f) => keys.has(f.dataset));
      const rows = s.datasets.reduce((a, d) => a + (store[d.key]?.length ?? 0), 0);
      const affected = new Set(fs.map((f) => `${f.dataset}|${f.row}`)).size;
      return {
        name: sectorLabel(s.key).replace(/^أنشطة وعمليات |^الأنشطة والعمليات /, ""),
        high: fs.filter((f) => f.finalSeverity === "high").length,
        medium: fs.filter((f) => f.finalSeverity === "medium").length,
        low: fs.filter((f) => f.finalSeverity === "low").length,
        rows,
        compliance: rows ? Math.round((1 - Math.min(affected, rows) / rows) * 100) : null,
      };
    });
    const counts = new Map();
    findings.forEach((f) => {
      const k = f.test.replace(/^[^:]*:\s*/, (m) => (m.length < 28 ? "" : m));
      const e = counts.get(f.test) ?? { name: f.test, count: 0, high: 0 };
      e.count += 1;
      if (f.finalSeverity === "high") e.high += 1;
      counts.set(f.test, e);
    });
    const top = [...counts.values()].sort((a, b) => b.count - a.count || b.high - a.high).slice(0, 8).map((e) => ({ ...e, short: e.name.length > 38 ? `${e.name.slice(0, 38)}…` : e.name }));
    const status = [
      { name: "جديدة", value: historyStats?.new ?? 0, fill: COLORS.new },
      { name: "متكررة", value: historyStats?.recurring ?? 0, fill: COLORS.recurring },
      { name: "معالجة", value: historyStats?.resolved ?? resolved.length, fill: COLORS.resolved },
    ].filter((x) => x.value > 0);
    const aging = agingSummary(store, today);
    return { comp, bySector, top, status, aging };
  }, [store, findings, sectors, resolved, historyStats, today]);

  const high = findings.filter((f) => f.finalSeverity === "high").length;
  const pct = data.comp.pct;
  const pctColor = pct === null ? undefined : pct >= 90 ? COLORS.low : pct >= 75 ? COLORS.medium : COLORS.high;
  const hasData = data.comp.total > 0;

  return (
    <section aria-label="لوحة المؤشرات التنفيذية" style={{ margin: "19px 0 26px" }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>لوحة المؤشرات التنفيذية للبلدية</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <Kpi label="معدل الالتزام العام" value={pct === null ? "—" : `${pct}%`} color={pctColor} hint={hasData ? `${fmt(data.comp.affected)} سجل عليه ملاحظات من ${fmt(data.comp.total)}` : "لا سجلات"} />
        <Kpi label="ملاحظات مرتفعة المخاطر" value={fmt(high)} color={high ? COLORS.high : undefined} hint={`من ${fmt(findings.length)} ملاحظة`} />
        <Kpi label="ملاحظات متكررة" value={fmt(historyStats?.recurring ?? 0)} hint="مقارنة بالتقارير السابقة" />
        <Kpi label="ذمم متقادمة (> سنة)" value={fmt(data.aging.overYear)} hint="دينار — خسارة إيرادية محتملة" color={data.aging.overYear ? COLORS.medium : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12, marginTop: 12 }}>
        <div style={card}>
          <h4 style={h4}>توزيع المخاطر حسب النشاط</h4>
          {hasData ? (
            <div style={{ height: 260 }} dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bySector} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} height={50} textAnchor="end" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="high" name="مرتفعة" stackId="a" fill={COLORS.high} isAnimationActive={false} />
                  <Bar dataKey="medium" name="متوسطة" stackId="a" fill={COLORS.medium} isAnimationActive={false} />
                  <Bar dataKey="low" name="منخفضة" stackId="a" fill={COLORS.low} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </div>

        <div style={card}>
          <h4 style={h4}>نسبة الالتزام لكل نشاط (%)</h4>
          {hasData ? (
            <div style={{ height: 260 }} dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bySector.filter((s) => s.compliance !== null)} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="compliance" name="الالتزام" isAnimationActive={false}>
                    {data.bySector.filter((s) => s.compliance !== null).map((s) => (
                      <Cell key={s.name} fill={s.compliance >= 90 ? COLORS.low : s.compliance >= 75 ? COLORS.medium : COLORS.high} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </div>

        <div style={card}>
          <h4 style={h4}>أعلى الملاحظات تكراراً</h4>
          {data.top.length ? (
            <div style={{ height: 260 }} dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="short" width={170} tick={{ fontSize: 9 }} />
                  <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.name} />
                  <Bar dataKey="count" name="عدد الحالات" fill={COLORS.ink} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </div>

        <div style={card}>
          <h4 style={h4}>حالة الملاحظات مقابل التقارير السابقة</h4>
          {data.status.length ? (
            <div style={{ height: 260 }} dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.status} dataKey="value" nameKey="name" innerRadius={48} outerRadius={84} paddingAngle={2} isAnimationActive={false} label={(e) => `${e.name} ${e.value}`}>
                    {data.status.map((s) => (
                      <Cell key={s.name} fill={s.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </div>

        <div style={card}>
          <h4 style={h4}>تقادم الذمم والإيرادات (دينار)</h4>
          {data.aging.items.length ? (
            <div style={{ height: 260 }} dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.aging.buckets} margin={{ top: 4, right: 8, left: -4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="amount" name="المبلغ" isAnimationActive={false}>
                    {data.aging.buckets.map((b, i) => (
                      <Cell key={b.key} fill={["#16a34a", "#ca8a04", "#ea580c", "#dc2626"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </div>
      </div>
    </section>
  );
}
