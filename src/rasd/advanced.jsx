// @ts-nocheck
/* eslint-disable */
import { useEffect, useMemo, useState } from "react";
import { observationLines } from "./observations";
import { SECTOR_COMMANDS } from "./sector-commands.js";
import { nationalIdKey, scoreMatch, pct } from "./conflict-match.js";

export const SOD = "فصل الصلاحيات: ";
export const FRAUD = "مؤشر احتيال: ";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const txt = (v) => String(v ?? "").trim();
const nameOf = (s) =>
  txt(s)
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .toLowerCase();
const personOf = (s) => nameOf(s);
const fullName = (s) => {
  const a = nameOf(s);
  return a.split(" ").filter(Boolean).length >= 2 ? a : "";
};
const phoneOf = (s) => {
  const d = txt(s)
    .replace(/[٠-٩]/g, (c) => AR_DIGITS.indexOf(c))
    .replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-9) : "";
};
const acctOf = (s) => {
  const a = txt(s).replace(/[\s-]/g, "").toUpperCase();
  return a.length >= 6 ? a : "";
};
const addrOf = (s) => {
  const a = nameOf(s).replace(/[^\p{L}\p{N} ]/gu, "");
  return a.length >= 10 ? a : "";
};
const num = (v) => {
  const s = txt(v).replaceAll(",", "");
  const x = Number(s);
  return s === "" || !Number.isFinite(x) ? undefined : x;
};

const SOD_ROLES = {
  Payment_Vouchers: [
    ["entered_by", "إدخال السند"],
    ["approver", "اعتماد الصرف"],
    ["paid_by", "تنفيذ الصرف"],
  ],
  Direct_Purchases_Orders: [
    ["entered_by", "إدخال أمر الشراء"],
    ["approver", "الموافقة على الشراء"],
    ["received_by", "استلام المواد"],
  ],
};

export function sodFindings(store, sectorOf) {
  const out = [];
  const push = (dataset, row, severity, test, detail) =>
    out.push({ dataset, sector: sectorOf(dataset), row, severity, test, detail });

  for (const [dataset, roles] of Object.entries(SOD_ROLES)) {
    const rows = store[dataset] ?? [];
    let testable = 0;
    rows.forEach((r, i) => {
      const people = new Map();
      let filled = 0;
      roles.forEach(([key, label]) => {
        const p = personOf(r[key]);
        if (!p) return;
        filled++;
        people.set(p, [...(people.get(p) ?? []), { label, key, raw: txt(r[key]) }]);
      });
      if (filled >= 2) testable++;
      people.forEach((list) => {
        if (list.length < 2) return;
        const labels = list.map((x) => x.label);
        const hasApproval = list.some((x) => x.key === "approver");
        const all = list.length === roles.length;
        const severity = all || hasApproval ? "high" : "medium";
        const test = all
          ? `${SOD}جمع إدخال المعاملة واعتمادها وتنفيذها بيد موظف واحد`
          : `${SOD}جمع ${labels.join(" و")} بيد موظف واحد`;
        push(dataset, i, severity, test, list[0].raw);
      });
    });
    if (rows.length && !testable)
      push(
        dataset,
        0,
        "low",
        `${SOD}تعذر الاختبار لعدم إدخال بيانات المنفّذين`,
        roles.map((x) => x[1]).join("، "),
      );
  }

  const pos = store.Direct_Purchases_Orders ?? [];
  (store.Warehouses_Inbound_Vouchers ?? []).forEach((r, i) => {
    const po = txt(r.po_no);
    const rec = personOf(r.received_by);
    if (!po || !rec) return;
    pos
      .filter((p) => txt(p.po_no) === po)
      .forEach((p) => {
        if (personOf(p.approver) === rec)
          push(
            "Warehouses_Inbound_Vouchers",
            i,
            "high",
            `${SOD}أمين المستودع هو نفسه الموافق على أمر الشراء`,
            `${txt(r.received_by)} — ${po}`,
          );
        else if (personOf(p.entered_by) === rec)
          push(
            "Warehouses_Inbound_Vouchers",
            i,
            "medium",
            `${SOD}أمين المستودع هو نفسه مُدخل أمر الشراء`,
            `${txt(r.received_by)} — ${po}`,
          );
      });
  });
  return out;
}

const SUPPLIER_SOURCES = [
  { dataset: "Direct_Purchases_Orders", name: "supplier", phone: "supplier_phone", addr: "supplier_address", acct: "supplier_bank", nid: "supplier_national_id" },
  { dataset: "Tenders_Records", name: "winner", phone: "winner_phone", addr: "winner_address", acct: "winner_bank", nid: "winner_national_id" },
  { dataset: "Warehouses_Inbound_Vouchers", name: "supplier" },
];

export function fraudFindings(store, sectorOf) {
  const out = [];
  const push = (dataset, row, severity, test, detail) =>
    out.push({ dataset, sector: sectorOf(dataset), row, severity, test: FRAUD + test, detail });

  const emps = [];
  (store.HR_Payroll_Sheets ?? []).forEach((r) =>
    emps.push({
      src: "كشوفات الرواتب",
      name: txt(r.name),
      id: txt(r.employee_no || r.national_id),
      nid: nationalIdKey(r.national_id),
      nm: fullName(r.name),
      phone: phoneOf(r.phone),
      addr: addrOf(r.address),
      acct: acctOf(r.bank_account),
    }),
  );
  (store.HR_Daily_Wagers ?? []).forEach((r) =>
    emps.push({
      src: "المياومة",
      name: txt(r.name),
      id: txt(r.id_no),
      nid: nationalIdKey(r.id_no),
      nm: fullName(r.name),
      phone: phoneOf(r.phone),
      addr: addrOf(r.address),
      acct: acctOf(r.bank_account),
    }),
  );
  const index = (key) => {
    const m = new Map();
    emps.forEach((e, k) => {
      if (e[key]) m.set(e[key], [...(m.get(e[key]) ?? []), k]);
    });
    return m;
  };
  const byPhone = index("phone"),
    byAddr = index("addr"),
    byAcct = index("acct"),
    byNid = index("nid"),
    byName = index("nm");

  const suppliers = [];
  let withContact = 0;
  for (const s of SUPPLIER_SOURCES) {
    (store[s.dataset] ?? []).forEach((r, i) => {
      const sup = {
        dataset: s.dataset,
        row: i,
        raw: txt(r[s.name]),
        nm: fullName(r[s.name]),
        key: nameOf(r[s.name]),
        phone: s.phone ? phoneOf(r[s.phone]) : "",
        addr: s.addr ? addrOf(r[s.addr]) : "",
        acct: s.acct ? acctOf(r[s.acct]) : "",
        nid: s.nid ? nationalIdKey(r[s.nid]) : "",
      };
      if (sup.phone || sup.addr || sup.acct || sup.nid) withContact++;
      suppliers.push(sup);
    });
  }

  const DETAIL = { nid: "الرقم الوطني", phone: "رقم الهاتف", addr: "العنوان", acct: "الحساب البنكي", name: "الاسم" };
  const KEY_OF = { nid: "nid", phone: "phone", addr: "addr", acct: "acct" };
  const SINGLE = {
    nid: "تطابق الرقم الوطني بين مورد وموظف",
    acct: "تطابق حساب بنكي بين مورد وموظف",
    phone: "تطابق رقم هاتف بين مورد وموظف",
    addr: "تطابق عنوان بين مورد وموظف",
    name: "تطابق اسم مورد مع اسم موظف",
  };
  suppliers.forEach((sup) => {
    // المرشحون: كل موظف يشترك مع المورد بمؤشر واحد على الأقل؛ ثم تُحسب درجة الثقة المجمّعة لكل زوج
    const candidates = new Set();
    [
      [byNid, "nid"],
      [byAcct, "acct"],
      [byPhone, "phone"],
      [byAddr, "addr"],
    ].forEach(([map, key]) => sup[KEY_OF[key]] && (map.get(sup[KEY_OF[key]]) ?? []).forEach((k) => candidates.add(k)));
    if (sup.nm) (byName.get(sup.nm) ?? []).forEach((k) => candidates.add(k));
    candidates.forEach((k) => {
      const e = emps[k];
      const m = scoreMatch(sup, e);
      if (!m) return;
      const who = `${sup.raw} ↔ ${e.name} (${e.src}${e.id ? " " + e.id : ""})`;
      const test =
        m.signals.length >= 2 ? "تطابق متعدد المؤشرات بين مورد وموظف (شبهة تضارب مصالح)" : SINGLE[m.signals[0]];
      const why = m.signals.length >= 2 ? ` — ${m.signals.map((x) => DETAIL[x]).join("، ")}` : "";
      const note = m.conflictingNid ? " — الرقمان الوطنيان مختلفان (غالباً شخصان مختلفان)" : "";
      const f = {
        dataset: sup.dataset,
        sector: sectorOf(sup.dataset),
        row: sup.row,
        severity: m.level,
        test: FRAUD + test,
        detail: `${who}${why}${note} — درجة الثقة ${pct(m.confidence)}`,
        confidence: m.confidence,
        signals: m.signals,
      };
      out.push(f);
    });
  });

  const shared = (key, severity, test) => {
    const m = new Map();
    suppliers.forEach((s) => {
      if (s[key] && s.key) m.set(s[key], [...(m.get(s[key]) ?? []), s]);
    });
    m.forEach((list) => {
      if (new Set(list.map((x) => x.key)).size < 2) return;
      const names = [...new Set(list.map((x) => x.raw))].join(" / ");
      list.forEach((s) => push(s.dataset, s.row, severity, test, names));
    });
  };
  shared("nid", "high", "رقم وطني مشترك بين موردين مختلفين");
  shared("acct", "high", "حساب بنكي مشترك بين موردين مختلفين");
  shared("phone", "medium", "هاتف مشترك بين موردين مختلفين");

  (store.Direct_Purchases_Orders ?? []).forEach((r, i) => {
    const a = fullName(r.approver),
      s = fullName(r.supplier);
    if (a && s && a === s)
      push("Direct_Purchases_Orders", i, "high", "الموافق على الشراء هو نفسه المورد", txt(r.supplier));
  });

  if (suppliers.length && emps.length && !withContact)
    push(
      suppliers[0].dataset,
      suppliers[0].row,
      "low",
      "تعذر اختبار التطابق لعدم إدخال هاتف أو عنوان أو حساب بنكي أو رقم وطني للموردين",
      "",
    );
  return out;
}

const VALUE_KEYS = ["amount", "value", "net", "total", "awarded_value", "book_value", "variance_value", "closing", "approved", "cost", "invoices"];
export const valueKeyOf = (ds) =>
  VALUE_KEYS.find((k) => ds.fields.some((f) => f.key === k && f.type === "number")) ??
  ds.fields.find((f) => f.type === "number")?.key;

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

export function riskSample(ds, rows, sevByRow, { topPct = 20, randomPct = 10, seed = 1 } = {}) {
  const vk = valueKeyOf(ds);
  const vals = rows.map((r) => (vk ? num(r[vk]) : undefined));
  const idx = rows.map((_, i) => i);
  const reasons = new Map();
  const add = (i, why) => reasons.set(i, [...new Set([...(reasons.get(i) ?? []), why])]);

  const topN = Math.max(1, Math.ceil((rows.length * topPct) / 100));
  idx
    .filter((i) => vals[i] !== undefined)
    .sort((a, b) => vals[b] - vals[a])
    .slice(0, rows.length ? topN : 0)
    .forEach((i) => add(i, "top"));

  const known = vals.filter((v) => v !== undefined).sort((a, b) => a - b);
  let fence = Infinity;
  if (known.length >= 4) {
    const q = (p) => {
      const pos = (known.length - 1) * p,
        lo = Math.floor(pos),
        hi = Math.ceil(pos);
      return known[lo] + (known[hi] - known[lo]) * (pos - lo);
    };
    const q1 = q(0.25),
      q3 = q(0.75);
    if (q3 - q1 > 0) fence = q3 + 1.5 * (q3 - q1);
  }
  idx.forEach((i) => {
    const s = sevByRow.get(i);
    if (s === "high" || s === "medium") add(i, "flag");
    if (vals[i] !== undefined && vals[i] > fence) add(i, "outlier");
  });

  const rest = idx.filter((i) => !reasons.has(i));
  const k = rest.length ? Math.min(rest.length, Math.max(1, Math.ceil((rest.length * randomPct) / 100))) : 0;
  const rnd = mulberry32(hashStr(ds.key) + seed * 7919);
  const pool = [...rest];
  for (let j = 0; j < k; j++) {
    const p = j + Math.floor(rnd() * (pool.length - j));
    [pool[j], pool[p]] = [pool[p], pool[j]];
    add(pool[j], "random");
  }
  return {
    vk,
    total: rows.length,
    restCount: rest.length,
    picked: [...reasons.keys()].sort((a, b) => a - b).map((i) => ({ i, reasons: reasons.get(i) })),
  };
}

export function complianceOf(store, findings) {
  const total = Object.values(store).reduce((a, rs) => a + (Array.isArray(rs) ? rs.length : 0), 0);
  const affected = new Set(findings.map((f) => `${f.dataset}|${f.row}`)).size;
  return {
    total,
    affected,
    pct: total ? Math.round((1 - Math.min(affected, total) / total) * 1000) / 10 : null,
  };
}

const SEV = { high: "مرتفعة", medium: "متوسطة", low: "منخفضة" };

export function buildSummary({ store, findings, reports, sectors, datasetLabel, observations = [] }) {
  const date = new Date().toISOString().slice(0, 10);
  const comp = complianceOf(store, findings);
  const cnt = (s) => findings.filter((f) => f.finalSeverity === s).length;
  const highRecords = new Set(findings.filter((f) => f.finalSeverity === "high").map((f) => `${f.dataset}|${f.row}`)).size;
  const ratio = comp.total ? highRecords / comp.total : 0;
  const rating = !comp.total
    ? "غير مقيّمة (لا توجد بيانات)"
    : ratio === 0
      ? "جيدة"
      : ratio < 0.05
        ? "مقبولة مع ملاحظات"
        : ratio < 0.15
          ? "تحتاج إلى تحسين جوهري"
          : "ضعيفة";
  const last = [...reports].sort((a, b) => b.date.localeCompare(a.date))[0];
  const now = new Set(findings.map((f) => f.key));
  const resolved = last ? last.findings.filter((f) => !now.has(f.key)).length : 0;
  const repeated = findings.filter((f) => f.repeat).length;
  const sod = findings.filter((f) => f.test.startsWith(SOD));
  const fraud = findings.filter((f) => f.test.startsWith(FRAUD));

  const groups = new Map();
  findings
    .filter((f) => f.finalSeverity === "high")
    .forEach((f) => {
      const k = `${f.dataset}|${f.test}`;
      const g = groups.get(k) ?? { dataset: f.dataset, test: f.test, n: 0, rep: 0, reg: f.regulation?.doc, refs: [] };
      g.n++;
      if (f.repeat) g.rep++;
      if (g.refs.length < 3 && f.ref) g.refs.push(f.ref);
      groups.set(k, g);
    });
  const top = [...groups.values()].sort((a, b) => b.n - a.n).slice(0, 8);

  const b = [];
  b.push({ t: "h", x: "الملخص التنفيذي وخلاصة الرأي الرقابي" });
  b.push({ t: "p", x: `التاريخ: ${date} — عدد الأنشطة المشمولة: ${sectors.length} — عدد السجلات المفحوصة: ${comp.total}` });
  b.push({ t: "h2", x: "1. نظرة عامة على بيئة الرقابة" });
  b.push({
    t: "p",
    x: `التقدير العام لبيئة الرقابة: ${rating}. إجمالي الملاحظات ${findings.length} (مرتفعة ${cnt("high")}، متوسطة ${cnt("medium")}، منخفضة ${cnt("low")}). السجلات ذات الملاحظات المرتفعة ${highRecords} من ${comp.total}.`,
  });
  b.push({
    t: "note",
    x: "معيار التقدير (استرشادي): جيدة = لا سجلات مرتفعة المخاطر، مقبولة = أقل من 5% من السجلات، تحتاج تحسيناً = 5% إلى 15%، ضعيفة = 15% فأكثر.",
  });
  b.push({
    t: "tbl",
    head: ["النشاط / العملية", "السجلات", "مرتفعة", "متوسطة", "منخفضة"],
    rows: sectors.map((s) => {
      const fs = findings.filter((f) => f.sector === s.key);
      const n = s.datasets.reduce((a, d) => a + (store[d.key]?.length ?? 0), 0);
      return [s.label, n, fs.filter((f) => f.finalSeverity === "high").length, fs.filter((f) => f.finalSeverity === "medium").length, fs.filter((f) => f.finalSeverity === "low").length];
    }),
  });
  b.push({ t: "h2", x: "2. أبرز المخاطر الجوهرية التي تتطلب تدخلاً فورياً من الإدارة العليا" });
  if (!top.length) b.push({ t: "p", x: "لا توجد ملاحظات مرتفعة المخاطر حالياً." });
  top.forEach((g) =>
    b.push({
      t: "li",
      x: `${g.test} — ${datasetLabel(g.dataset)} — ${g.n} حالة${g.rep ? `، منها ${g.rep} متكررة من تقارير سابقة` : ""}${g.refs.length ? ` (أمثلة: ${g.refs.join("، ")})` : ""}${g.reg ? ` — المرجع النظامي: ${g.reg}` : ""}`,
    }),
  );
  b.push({ t: "h2", x: "3. الرقابة الداخلية ومؤشرات الاحتيال" });
  b.push({
    t: "p",
    x: `ملاحظات فصل الصلاحيات: ${sod.length} (مرتفعة ${sod.filter((f) => f.finalSeverity === "high").length}). مؤشرات الاحتيال وتضارب المصالح: ${fraud.length} (مرتفعة ${fraud.filter((f) => f.finalSeverity === "high").length}).`,
  });
  b.push({ t: "h2", x: "4. الالتزام ومقارنة التقارير السابقة" });
  b.push({
    t: "p",
    x: `نسبة السجلات الخالية من الملاحظات حالياً: ${comp.pct === null ? "—" : comp.pct + "%"}.`,
  });
  if (last) {
    const pc = last.compliance?.pct;
    b.push({
      t: "p",
      x: `آخر تقرير محفوظ: «${last.name}» (${last.date}) وفيه ${last.findings.length} ملاحظة، منها ${last.findings.filter((f) => f.severity === "high").length} مرتفعة. نسبة الالتزام فيه: ${pc === undefined ? "غير متوفرة (تقرير قديم أو مستورد)" : pc + "%"}${pc !== undefined && comp.pct !== null ? ` (التغير ${comp.pct - pc >= 0 ? "+" : ""}${Math.round((comp.pct - pc) * 10) / 10} نقطة)` : ""}.`,
    });
    b.push({ t: "p", x: `الملاحظات المعالجة منذ ذلك التقرير: ${resolved}. الملاحظات المتكررة: ${repeated}.` });
  } else b.push({ t: "p", x: "لا يوجد تقرير سابق محفوظ للمقارنة. احفظ تقريراً أو استورد تقريراً سابقاً بصيغة PDF." });
  b.push({ t: "h2", x: "5. الملاحظات الرقابية (الحالة، السبب، السند القانوني، الأثر)" });
  if (!observations.length) b.push({ t: "p", x: "لا توجد ملاحظات رقابية مصاغة حالياً." });
  observations.slice(0, 15).forEach((o, oi) => {
    const [title, ...rest] = observationLines(o, SEV, oi + 1);
    b.push({ t: "li", x: `${title}${o.status === "approved" ? " — معتمدة" : " — مسودة"}` });
    rest.forEach((x) => b.push({ t: "p", x }));
  });
  return { date, blocks: b, rating, comp };
}

export function blocksToText(blocks) {
  return blocks
    .map((k) =>
      k.t === "tbl"
        ? [k.head.join(" | "), ...k.rows.map((r) => r.join(" | "))].join("\n")
        : k.t === "li"
          ? `- ${k.x}`
          : k.x,
    )
    .join("\n\n");
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
export function blocksToHtml(blocks, footer) {
  const body = blocks
    .map((k) =>
      k.t === "h"
        ? `<h1>${esc(k.x)}</h1>`
        : k.t === "h2"
          ? `<h2>${esc(k.x)}</h2>`
          : k.t === "li"
            ? `<p class="li">• ${esc(k.x)}</p>`
            : k.t === "note"
              ? `<p class="note">${esc(k.x)}</p>`
              : k.t === "tbl"
                ? `<table><tr>${k.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${k.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`
                : `<p>${esc(k.x)}</p>`,
    )
    .join("");
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>الملخص التنفيذي</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:32px;line-height:1.8}h1{font-size:22px}h2{font-size:16px;margin-top:22px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #999;padding:6px;text-align:right}.note{font-size:12px;color:#555}.li{margin:4px 0}.sign{margin-top:36px;border-top:1px solid #999;padding-top:10px}</style></head><body>${body}<div class="sign">${esc(footer)}</div></body></html>`;
}

/** Kept for compatibility: the fleet activity's built-in command. */
export const FLEET_COMMAND = SECTOR_COMMANDS.fleet[0];

const CMD_KEY = "rasd-sector-commands";
const CMD_VERSION = 3;
// built-in commands of each activity (each has a stable seedId)
const SEEDS = SECTOR_COMMANDS;
const cmdNorm = (t) => nameOf(t).replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ");
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2)}`);

const cmdTokens = (t) => new Set(cmdNorm(t).split(" ").filter((w) => w.length > 1));
const jaccard = (x, y) => {
  let i = 0;
  x.forEach((w) => y.has(w) && i++);
  const u = x.size + y.size - i;
  return u ? i / u : 0;
};
const NEAR_SAME = 0.75;
const sameCommand = (a, b) => a.k === b.k || jaccard(a.tk, b.tk) >= NEAR_SAME;
const keyed = (text) => ({ k: cmdNorm(text), tk: cmdTokens(text) });

/** The old built-in fleet command (replaced by the specialised one); removed when found in saved data. */
const OLD_SEED_IDS = new Set(["base", "revenue", "engineering"]);
const OLD_TITLE = cmdNorm("الأمر التخصصي لنشاط");
const isLegacyBuiltIn = (c) =>
  cmdNorm(c.text).startsWith(cmdNorm("بصفتك خبير تدقيق نظم رقابية ومالية، قم بإجراء فحص تشغيلي وتقاطعي شامل ومتقاطع للنشاط الثالث")) ||
  (c.seedId && OLD_SEED_IDS.has(c.seedId)) ||
  cmdNorm(c.title ?? "").startsWith(OLD_TITLE);

/** Remove repeated commands (same or nearly the same text) while keeping the first and the original order. */
export function dedupeCommands(list) {
  const kept = [];
  return list.filter((c) => {
    const k = keyed(c.text);
    if (!k.k || kept.some((p) => sameCommand(p, k))) return false;
    kept.push(k);
    return true;
  });
}

/** Add a command to one activity only; returns the new store and whether it was accepted. */
export function addCommand(items, sectorKey, title, text) {
  const t = txt(text);
  if (!t) return { items, ok: false, reason: "empty" };
  const cur = items[sectorKey] ?? [];
  const k = keyed(t);
  if (cur.some((c) => sameCommand(keyed(c.text), k))) return { items, ok: false, reason: "duplicate" };
  const c = { id: newId(), title: txt(title) || t.split("\n")[0].slice(0, 80), text: t };
  return { items: { ...items, [sectorKey]: [...cur, c] }, ok: true };
}

export function loadCommands() {
  let v = null;
  try {
    v = JSON.parse(localStorage.getItem(CMD_KEY) ?? "null");
  } catch {}
  const known = v && typeof v === "object" && (v.version === CMD_VERSION || v.version === 2) && v.items && typeof v.items === "object";
  const migrating = known && v.version !== CMD_VERSION;
  const items = known ? v.items : {};
  // older saves are migrated: the old built-in command goes, the new built-ins are added once
  const seeded = known && !migrating && v.seeded && typeof v.seeded === "object" ? v.seeded : {};
  const out = {};
  for (const k of Object.keys(items))
    out[k] = dedupeCommands((Array.isArray(items[k]) ? items[k] : []).filter((c) => c && !isLegacyBuiltIn(c)));
  // Each built-in command is added once per install (tracked by seedId); after that the user can delete it for good.
  // A command added in a later version reaches existing users once, right after their other built-in commands.
  const seededNow = {};
  let added = false;
  for (const [k, list] of Object.entries(SEEDS)) {
    const prev = seeded[k];
    const have = new Set(Array.isArray(prev) ? prev : prev === true ? ["base"] : []);
    const fresh = list.filter((c) => !have.has(c.seedId));
    if (fresh.length) {
      const cur = out[k] ?? [];
      let at = 0; // first install: built-ins come first, so they win over older copies of themselves
      if (have.size)
        cur.forEach((c, i) => {
          if (list.some((sd) => sameCommand(keyed(sd.text), keyed(c.text)))) at = i + 1;
        });
      out[k] = dedupeCommands([...cur.slice(0, at), ...fresh.map((c) => ({ id: newId(), ...c })), ...cur.slice(at)]);
      added = true;
    }
    seededNow[k] = list.map((c) => c.seedId);
  }
  const state = { items: out, seeded: seededNow };
  if (migrating || added) saveCommands(state);
  return state;
}

export function saveCommands(state) {
  try {
    localStorage.setItem(CMD_KEY, JSON.stringify({ version: CMD_VERSION, ...state }));
  } catch {}
}

function CommandsTab({ Button, sector }) {
  const [state, setState] = useState(() => loadCommands());
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");
  const list = state.items[sector.key] ?? [];

  const commit = (items) => {
    const next = { ...state, items };
    setState(next);
    saveCommands(next);
  };
  function add() {
    const r = addCommand(state.items, sector.key, title, text);
    if (!r.ok) {
      setNote(r.reason === "duplicate" ? "هذا الأمر موجود مسبقاً في هذا النشاط، لم يُضف مرة ثانية." : "اكتب نص الأمر أولاً.");
      return;
    }
    commit(r.items);
    setTitle("");
    setText("");
    setNote("تمت إضافة الأمر إلى هذا النشاط فقط.");
  }
  const remove = (id) => commit({ ...state.items, [sector.key]: list.filter((c) => c.id !== id) });
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    commit({ ...state.items, [sector.key]: n });
  };
  async function copy(id, t) {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    } catch {}
  }
  const restoreDefault = () => {
    const seed = SEEDS[sector.key] ?? [];
    const r = dedupeCommands([...list, ...seed.map((c) => ({ id: newId(), ...c }))]);
    commit({ ...state.items, [sector.key]: r });
  };
  const allText = list.map((c, i) => `الأمر ${i + 1}: ${c.title}\n${c.text}`).join("\n\n— ثم —\n\n");

  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground">
        أوامر النشاط: «{sector.label}». تُحفظ هذه الأوامر لهذا النشاط فقط ولا تظهر في بقية الأنشطة، وتُنفَّذ بالترتيب الظاهر والسهم يبيّن التسلسل.
      </p>
      <div className="mt-4 grid gap-2">
        <input className="field-input" placeholder="عنوان الأمر (اختياري)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="field-input" rows={5} placeholder="اكتب أو الصق نص الأمر هنا" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ink" onClick={add}>إضافة الأمر</Button>
          {SEEDS[sector.key] && <Button size="sm" variant="outline" onClick={restoreDefault}>استعادة الأوامر المعتمدة للنشاط</Button>}
          {list.length > 1 && <Button size="sm" variant="outline" onClick={() => copy("all", allText)}>{copied === "all" ? "تم النسخ" : "نسخ كل الأوامر بالترتيب"}</Button>}
          {note && <span role="status" className="text-xs text-muted-foreground">{note}</span>}
        </div>
      </div>
      {!list.length ? (
        <p className="py-6 text-center text-xs text-muted-foreground">لا توجد أوامر لهذا النشاط بعد.</p>
      ) : (
        <ol className="mt-4 grid list-none gap-0 p-0">
          {list.map((c, i) => (
            <li key={c.id} className="grid gap-0">
              <div className="stat-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{i + 1}. {c.title}</span>
                  <span className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" disabled={i === 0} onClick={() => move(i, -1)} aria-label="تقديم">↑</Button>
                    <Button size="sm" variant="outline" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="تأخير">↓</Button>
                    <Button size="sm" variant="outline" onClick={() => copy(c.id, c.text)}>{copied === c.id ? "تم النسخ" : "نسخ"}</Button>
                    <Button size="sm" variant="outline" onClick={() => remove(c.id)}>حذف</Button>
                  </span>
                </div>
              </div>
              {i < list.length - 1 && (
                <div className="py-1 text-center text-lg text-muted-foreground" aria-hidden="true">⬇</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const REASON = { top: "ضمن أعلى القيم", flag: "عليه ملاحظة", outlier: "قيمة شاذة", random: "عينة عشوائية" };

export function AdvancedPanel({ observations, Button, store, findings, reports, ds, sector, sectors, sevLabel, sevClass, datasetLabel }) {
  const [tab, setTab] = useState("cmds");
  const [topPct, setTopPct] = useState(20);
  const [randomPct, setRandomPct] = useState(10);
  const [seed, setSeed] = useState(1);
  const [auditor, setAuditor] = useState("");
  const [approval, setApproval] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("rasd-exec-approval") ?? "null");
      if (v) setApproval(v);
    } catch {}
  }, []);

  const summary = useMemo(
    () => buildSummary({ store, findings, reports, sectors, datasetLabel, observations }),
    [store, findings, reports, sectors, observations],
  );
  const text = useMemo(() => blocksToText(summary.blocks), [summary]);
  const sig = useMemo(() => `${text.length}:${hashStr(text)}`, [text]);
  const approved = approval && approval.sig === sig;

  const rows = store[ds.key] ?? [];
  const sevByRow = useMemo(() => {
    const m = new Map();
    const rank = { high: 3, medium: 2, low: 1 };
    findings
      .filter((f) => f.dataset === ds.key)
      .forEach((f) => {
        if ((rank[f.finalSeverity] ?? 0) > (rank[m.get(f.row)] ?? 0)) m.set(f.row, f.finalSeverity);
      });
    return m;
  }, [findings, ds.key]);
  const sample = useMemo(
    () => riskSample(ds, rows, sevByRow, { topPct, randomPct, seed }),
    [ds, rows, sevByRow, topPct, randomPct, seed],
  );
  const valueLabel = ds.fields.find((f) => f.key === sample.vk)?.label;

  const subset = (prefix) => findings.filter((f) => f.test.startsWith(prefix));
  const list = tab === "sod" ? subset(SOD) : tab === "fraud" ? subset(FRAUD) : [];

  const footer = approved
    ? `معتمد من المدقق: ${approval.name} — بتاريخ ${approval.date}`
    : "الحالة: مسودة بانتظار مراجعة واعتماد المدقق";

  function approve() {
    if (!auditor.trim()) return;
    const v = { name: auditor.trim(), date: new Date().toISOString().slice(0, 10), sig };
    setApproval(v);
    localStorage.setItem("rasd-exec-approval", JSON.stringify(v));
  }
  function printSummary() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(blocksToHtml(summary.blocks, footer));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }
  async function copySummary() {
    try {
      await navigator.clipboard.writeText(`${text}\n\n${footer}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  async function exportSample() {
    const X = await import("xlsx");
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(
      wb,
      X.utils.json_to_sheet(
        sample.picked.map(({ i, reasons }) => ({
          "رقم السجل": i + 1,
          "سبب الاختيار": reasons.map((r) => REASON[r]).join("، "),
          ...Object.fromEntries(ds.fields.map((f) => [f.label, rows[i][f.key] ?? ""])),
        })),
      ),
      "العينة",
    );
    X.writeFile(wb, `sample-${ds.key}.xlsx`);
  }

  const tabs = [
    ["cmds", "أوامر النشاط"],
    ["exec", "التقرير التنفيذي"],
    ["sod", `فصل الصلاحيات (${subset(SOD).length})`],
    ["fraud", `كشف الاحتيال (${subset(FRAUD).length})`],
    ["sample", "العينات الموجهة بالمخاطر"],
  ];

  return (
    <section className="table-panel stat-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">الأوامر الرقابية المتقدمة</h3>
        <div className="flex flex-wrap gap-2">
          {tabs.map(([k, l]) => (
            <Button key={k} size="sm" variant={tab === k ? "ink" : "outline"} onClick={() => setTab(k)}>
              {l}
            </Button>
          ))}
        </div>
      </div>

      {tab === "cmds" && sector && <CommandsTab Button={Button} sector={sector} />}

      {tab === "exec" && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={printSummary}>طباعة / حفظ PDF</Button>
            <Button size="sm" variant="outline" onClick={copySummary}>{copied ? "تم النسخ" : "نسخ النص"}</Button>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            {summary.blocks.map((k, i) =>
              k.t === "h" ? <h2 key={i} className="text-base font-bold">{k.x}</h2>
              : k.t === "h2" ? <h4 key={i} className="mt-2 font-semibold">{k.x}</h4>
              : k.t === "note" ? <p key={i} className="text-xs text-muted-foreground">{k.x}</p>
              : k.t === "li" ? <p key={i} className="text-xs">• {k.x}</p>
              : k.t === "tbl" ? (
                <div key={i} className="table-scroll">
                  <table className="data-table">
                    <thead><tr>{k.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>{k.rows.map((r, j) => <tr key={j}>{r.map((c, m) => <td key={m}>{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              ) : <p key={i} className="text-xs">{k.x}</p>,
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className={`status-badge ${approved ? sevClass.none : sevClass.medium}`}>{footer}</span>
            {!approved && (
              <>
                <input className="field-input" style={{ maxWidth: 220 }} placeholder="اسم المدقق المعتمد" value={auditor} onChange={(e) => setAuditor(e.target.value)} />
                <Button size="sm" variant="ink" onClick={approve}>اعتماد المدقق</Button>
              </>
            )}
          </div>
          {approval && !approved && (
            <p className="mt-2 text-xs text-muted-foreground">تغيّرت البيانات منذ الاعتماد السابق، ويلزم اعتماد جديد.</p>
          )}
        </div>
      )}

      {(tab === "sod" || tab === "fraud") && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            {tab === "sod"
              ? "يفحص إدخال المعاملة واعتمادها وتنفيذها أو استلامها في سندات الصرف وأوامر الشراء وسندات الإدخال. يحتاج الأعمدة: مُدخل السجل، المعتمد، المنفّذ/المستلم."
              : "يطابق هاتف وعنوان وحساب بنكي واسم الموردين وأصحاب العطاءات مع الموظفين والمياومة، ويكشف تشارك الحسابات والهواتف بين الموردين. يحتاج تعبئة أعمدة الاتصال والحساب البنكي."}
          </p>
          {!list.length ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا توجد ملاحظات في هذا الاختبار.</p>
          ) : (
            <div className="table-scroll mt-4">
              <table className="data-table">
                <thead>
                  <tr><th>المخاطر</th><th>الجدول</th><th>المعرّف</th><th>الاختبار</th><th>التفاصيل</th></tr>
                </thead>
                <tbody>
                  {list.slice(0, 150).map((f, i) => (
                    <tr key={i}>
                      <td><span className={`status-badge ${sevClass[f.finalSeverity]}`}>{sevLabel[f.finalSeverity]}</span></td>
                      <td>{datasetLabel(f.dataset)}</td>
                      <td>{f.ref}</td>
                      <td>{f.test.replace(tab === "sod" ? SOD : FRAUD, "")}</td>
                      <td className="max-w-72 text-[11px]">{f.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "sample" && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            الجدول المحدد: {ds.label} ({rows.length} سجل). تُختار: أعلى نسبة من القيم{valueLabel ? ` حسب «${valueLabel}»` : ""}، وكل سجل عليه ملاحظة متوسطة أو مرتفعة أو قيمة شاذة، ثم عينة عشوائية من بقية السجلات. غيّر الجدول من قائمة الأنشطة أعلاه.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">
              <span>نسبة أعلى القيم (%)</span>
              <input className="field-input" type="number" min={1} max={100} value={topPct} onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 100) setTopPct(v); }} />
            </label>
            <label className="grid gap-1 text-xs">
              <span>نسبة العينة العشوائية من الباقي (%)</span>
              <input className="field-input" type="number" min={1} max={100} value={randomPct} onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 100) setRandomPct(v); }} />
            </label>
            <div className="flex items-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setSeed((s) => s + 1)}>إعادة السحب العشوائي</Button>
              <Button size="sm" variant="ink" disabled={!sample.picked.length} onClick={exportSample}>تصدير العينة</Button>
            </div>
          </div>
          <p className="mt-3 text-xs">
            حجم العينة: {sample.picked.length} من {sample.total} ({sample.total ? Math.round((sample.picked.length / sample.total) * 100) : 0}%) — رقم السحب {seed}
          </p>
          {!sample.picked.length ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا توجد سجلات في هذا الجدول.</p>
          ) : (
            <div className="table-scroll mt-3">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم السجل</th>
                    <th>سبب الاختيار</th>
                    {ds.fields.slice(0, 4).map((f) => <th key={f.key}>{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sample.picked.slice(0, 200).map(({ i, reasons }) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td className="text-[11px]">{reasons.map((r) => REASON[r]).join("، ")}</td>
                      {ds.fields.slice(0, 4).map((f) => <td key={f.key}>{rows[i][f.key] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
