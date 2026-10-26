// @ts-nocheck
/**
 * الأوامر المتقدمة (نصوص advanced.jsx / sector-commands.js) محوّلة إلى استعلامات خوارزمية تعمل آلياً ضمن runAudit.
 * كل استعلام يقرأ جداول النشاط من المخزن (store) ويُرجع ملاحظات بالشكل نفسه الذي يُرجعه بقية المحرك:
 *   { dataset, sector, row, severity, test, detail, amount? }
 * وكلها تحمل البادئة ADV ليتمكن المدقق من عزلها في تبويب «الأوامر المتقدمة».
 */
export const ADV = "استعلام آلي: ";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const txt = (v) => String(v ?? "").trim();
const latin = (s) => txt(s).replace(/[٠-٩]/g, (c) => AR_DIGITS.indexOf(c));
const norm = (s) =>
  txt(s)
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .toLowerCase();
const fullName = (s) => {
  const a = norm(s);
  return a.split(" ").filter(Boolean).length >= 2 ? a : "";
};
const num = (v) => {
  const s = latin(v).replaceAll(",", "");
  const x = Number(s);
  return s === "" || !Number.isFinite(x) ? undefined : x;
};
const DAY = 864e5;
const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** يحلل تاريخاً (ووقتاً إن وُجد) بصورة حتمية بلا اعتماد على المنطقة الزمنية. */
export function parseStamp(v) {
  const s = latin(v);
  if (!s) return undefined;
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/.exec(s);
  let y, mo, da, h, mi;
  if (m) [, y, mo, da, h, mi] = m;
  else if ((m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s]+(\d{1,2}):(\d{2}))?/.exec(s))) [, da, mo, y, h, mi] = m;
  else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return undefined;
    const dt = new Date(t);
    return { t, day: dt.getDay(), hour: undefined, minute: undefined };
  }
  const t = Date.UTC(+y, +mo - 1, +da, +(h ?? 0), +(mi ?? 0));
  if (Number.isNaN(t)) return undefined;
  const hasTime = h !== undefined && !(+h === 0 && +mi === 0);
  return { t, day: new Date(t).getUTCDay(), hour: hasTime ? +h : undefined, minute: hasTime ? +mi : undefined };
}

const dateOf = (v) => parseStamp(v)?.t;
const groupBy = (items, key) => {
  const m = new Map();
  items.forEach((x) => {
    const k = key(x);
    if (k) m.set(k, [...(m.get(k) ?? []), x]);
  });
  return m;
};
const money = (x) => Number(x).toLocaleString("en-US", { maximumFractionDigits: 2 });

/* ------------------------------ تقادم الذمم والإيرادات ------------------------------ */

export const AGING_BUCKETS = [
  { key: "b0", label: "0 – 90 يوماً", from: 0, to: 90 },
  { key: "b1", label: "91 – 180 يوماً", from: 91, to: 180 },
  { key: "b2", label: "181 – 365 يوماً", from: 181, to: 365 },
  { key: "b3", label: "أكثر من سنة", from: 366, to: Infinity },
];
export const bucketOf = (days) => AGING_BUCKETS.find((b) => days >= b.from && days <= b.to) ?? AGING_BUCKETS[0];

/** كل ذمة مدينة مفتوحة في جداول الإيرادات والسلف مع عمرها بالأيام. */
export function agingItems(store, today = Date.now()) {
  const out = [];
  const add = (dataset, row, who, amount, since, label) => {
    if (!(amount > 0) || since === undefined || since > today) return;
    out.push({ dataset, row, who: txt(who), amount, days: Math.floor((today - since) / DAY), label });
  };
  (store.Revenue_Profession_Licenses ?? []).forEach((r, i) => {
    const due = num(r.fee_due);
    if (due !== undefined) add("Revenue_Profession_Licenses", i, r.owner || r.license_no, due - (num(r.fee_paid) ?? 0), dateOf(r.date), "رسوم رخص المهن");
  });
  (store.Revenue_Property_Taxes_Regulation ?? []).forEach((r, i) => {
    const due = num(r.amount_due);
    const y = /^\d{4}$/.test(latin(r.year)) ? Number(latin(r.year)) : undefined;
    const since = y ? Date.UTC(y, 11, 31) : dateOf(r.last_payment);
    if (due !== undefined) add("Revenue_Property_Taxes_Regulation", i, r.owner || r.parcel_no, due - (num(r.amount_paid) ?? 0), since, "عوائد التنظيم والمسقفات");
  });
  (store.Revenue_Municipal_Properties_Leases ?? []).forEach((r, i) => {
    const inst = num(r.installment);
    if (inst === undefined || txt(r.paid_date)) return;
    add("Revenue_Municipal_Properties_Leases", i, r.tenant || r.contract_no, inst - (num(r.paid_amount) ?? 0), dateOf(r.due_date), "أقساط الأملاك المؤجرة");
  });
  (store.Revenue_Daily_Fees ?? []).forEach((r, i) => {
    const due = num(r.amount_due);
    if (due !== undefined) add("Revenue_Daily_Fees", i, r.collector || r.service, due - (num(r.amount_collected) ?? 0), dateOf(r.date), "رسوم الخدمات اليومية");
  });
  (store.Advances_Overdue_Outstanding ?? []).forEach((r, i) => {
    const a = num(r.amount);
    const days = num(r.days);
    if (a !== undefined && days !== undefined && a > 0) out.push({ dataset: "Advances_Overdue_Outstanding", row: i, who: txt(r.beneficiary || r.advance_no), amount: a, days, label: "ذمم السلف المتأخرة" });
  });
  return out;
}

/** ملخص التقادم للوحة المؤشرات والتقارير. */
export function agingSummary(store, today = Date.now()) {
  const items = agingItems(store, today);
  const buckets = AGING_BUCKETS.map((b) => {
    const list = items.filter((x) => bucketOf(x.days).key === b.key);
    return { ...b, count: list.length, amount: list.reduce((a, x) => a + x.amount, 0) };
  });
  return { items, buckets, total: items.reduce((a, x) => a + x.amount, 0), overYear: buckets[3].amount };
}

/* ------------------------------ الاستعلامات ------------------------------ */

const FIN_TIMED = [
  { dataset: "Receipt_Vouchers", date: "date", user: null, no: "voucher_no", amount: "amount" },
  { dataset: "Payment_Vouchers", date: "date", user: "entered_by", no: "voucher_no", amount: "amount" },
  { dataset: "Adjustments", date: "date", user: "requester", no: "entry_no", amount: "amount", adjustment: true },
];

const queries = [
  {
    id: "finance.offHours",
    sector: "finance",
    command: 0,
    title: "المعاملات والقيود خارج الدوام أو في العطل",
    run({ store, push, p }) {
      for (const s of FIN_TIMED)
        (store[s.dataset] ?? []).forEach((r, i) => {
          const st = parseStamp(r[s.date]);
          if (!st) return;
          const weekend = st.day === 5 || st.day === 6; // الجمعة والسبت
          const late = st.hour !== undefined && (st.hour < p.workStartHour || st.hour >= p.workEndHour);
          if (!weekend && !late) return;
          const night = st.hour !== undefined && (st.hour >= 22 || st.hour < 5);
          const when = `${WEEKDAYS[st.day]}${st.hour !== undefined ? ` ${String(st.hour).padStart(2, "0")}:${String(st.minute).padStart(2, "0")}` : ""}`;
          const user = s.user && txt(r[s.user]) ? txt(r[s.user]) : "المستخدم غير مسجل";
          push(s.dataset, i, night || (s.adjustment && late) ? "high" : "medium", `${ADV}معاملة مالية خارج الدوام الرسمي أو في العطلة`, `${txt(r[s.no])} — ${when} — ${user}`, num(r[s.amount]));
        });
    },
  },
  {
    id: "finance.receivablesAging",
    sector: "finance",
    command: 1,
    title: "تقادم الذمم والإيرادات",
    run({ store, push, today }) {
      for (const it of agingItems(store, today)) {
        const b = bucketOf(it.days);
        if (b.key === "b0") continue;
        const severity = b.key === "b3" ? "high" : b.key === "b2" ? "medium" : "low";
        const action = b.key === "b3" ? " — يُتحقق من اتخاذ إجراءات التحصيل والحجز التحفظي" : "";
        push(it.dataset, it.row, severity, `${ADV}تقادم ذمة إيراد (${b.label})`, `${it.label}: ${it.who || "—"} — ${money(it.amount)} متأخرة ${it.days} يوماً${action}`, it.amount);
      }
    },
  },
  {
    id: "finance.payeeIsEmployee",
    sector: "finance",
    command: 1,
    title: "تقاطع المدفوع له مع بيانات الموظفين",
    run({ store, push }) {
      const staff = new Set([...(store.HR_Payroll_Sheets ?? []), ...(store.HR_Daily_Wagers ?? [])].map((r) => fullName(r.name)).filter(Boolean));
      if (!staff.size) return;
      const salaryLike = /رواتب|أجور|اجور|مكاف|علاو|إضافي|اضافي|سلف|إجازات|اجازات|تقاعد/;
      (store.Payment_Vouchers ?? []).forEach((r, i) => {
        const who = fullName(r.payee);
        if (who && staff.has(who) && !salaryLike.test(txt(r.budget_item)))
          push("Payment_Vouchers", i, "medium", `${ADV}تقاطع: المدفوع له موظف على بند غير الرواتب`, `${txt(r.payee)} — ${txt(r.budget_item) || "بند غير مسجل"}`, num(r.amount));
      });
    },
  },
  {
    id: "hr.overtimeConcentration",
    sector: "hr",
    command: 1,
    title: "تركّز العمل الإضافي بيد موظف واحد",
    run({ store, push, p }) {
      const rows = (store.HR_Overtime_Bonuses ?? []).map((r, i) => ({ r, i, h: num(r.hours) ?? 0 }));
      groupBy(rows, (x) => `${norm(x.r.department) || "-"}|${norm(x.r.period) || "-"}`).forEach((list) => {
        const total = list.reduce((a, x) => a + x.h, 0);
        const people = groupBy(list, (x) => norm(x.r.employee_no || x.r.name));
        if (total <= 0 || people.size < 3) return;
        let top;
        people.forEach((l, k) => {
          const h = l.reduce((a, x) => a + x.h, 0);
          if (!top || h > top.h) top = { k, h, l };
        });
        const share = (top.h / total) * 100;
        if (share >= p.overtimeConcentrationPct)
          push("HR_Overtime_Bonuses", top.l[0].i, share >= 50 ? "high" : "medium", `${ADV}استحواذ موظف على النسبة الأكبر من الإضافي`, `${txt(top.l[0].r.name)} — ${share.toFixed(0)}% من ${money(total)} ساعة في القسم والفترة`, num(top.l[0].r.overtime_pay));
      });
    },
  },
  {
    id: "fleet.cardMultiVehicle",
    sector: "fleet",
    command: 1,
    title: "البطاقة الذكية الواحدة على آليات مختلفة",
    run({ store, push }) {
      const orders = store.Fleet_Movement_Orders ?? [];
      const hasOrder = (veh, stamp) => {
        const day = stamp ? Math.floor(stamp.t / DAY) : undefined;
        return orders.some((o) => norm(o.vehicle) === norm(veh) && day !== undefined && Math.floor((dateOf(o.date) ?? -1) / DAY) === day);
      };
      groupBy(
        (store.Fleet_Station_Fuel_Statements ?? []).map((r, i) => ({ r, i })),
        (x) => norm(x.r.card_no).replace(/\s/g, ""),
      ).forEach((list, card) => {
        const vehicles = new Set(list.map((x) => norm(x.r.vehicle)).filter(Boolean));
        if (vehicles.size < 2) return;
        list.forEach(({ r, i }) => {
          const justified = hasOrder(r.vehicle, parseStamp(r.datetime));
          push("Fleet_Station_Fuel_Statements", i, justified ? "medium" : "high", `${ADV}بطاقة ذكية مستخدمة لآليات مختلفة`, `البطاقة ${card}: ${[...vehicles].join(" / ")}${justified ? "" : " — دون أمر حركة مبرر"}`, num(r.amount));
        });
      });
    },
  },
  {
    id: "warehouses.repeatedDeficit",
    sector: "warehouses",
    command: 0,
    title: "العجز المتكرر في الأصناف عالية التكلفة",
    run({ store, push }) {
      const costs = new Map((store.Warehouse_Master_List ?? []).map((r) => [norm(r.item_no), num(r.cost) ?? 0]));
      const sorted = [...costs.values()].filter((c) => c > 0).sort((a, b) => a - b);
      const high = sorted.length ? sorted[Math.floor(sorted.length * 0.8)] : Infinity;
      const rows = (store.Warehouses_Physical_Stocktaking ?? []).map((r, i) => ({ r, i, v: (num(r.physical) ?? 0) - (num(r.book) ?? 0) })).filter((x) => x.v < 0 && txt(x.r.item_no));
      groupBy(rows, (x) => norm(x.r.item_no)).forEach((list, item) => {
        const costly = (costs.get(item) ?? 0) >= high && high > 0;
        if (list.length < 2 && !costly) return;
        list.forEach(({ r, i, v }) =>
          push("Warehouses_Physical_Stocktaking", i, list.length >= 2 && costly ? "high" : "medium", `${ADV}${list.length >= 2 ? "عجز متكرر" : "عجز"} في صنف عالي التكلفة`, `${txt(r.name) || txt(r.item_no)} — عجز ${Math.abs(v)} وحدة${list.length >= 2 ? ` (تكرر ${list.length} مرات)` : ""}`, num(r.variance_value) ?? Math.abs(v) * (costs.get(item) ?? 0)),
        );
      });
    },
  },
  {
    id: "warehouses.stagnation",
    sector: "warehouses",
    command: 1,
    title: "ركود المخزون وتجميد المال العام",
    run({ store, push, today, p }) {
      (store.Warehouses_Obsolete ?? []).forEach((r, i) => {
        const t = dateOf(r.in_date);
        if (t === undefined || t > today) return;
        const months = Math.floor((today - t) / (DAY * 30.4));
        if (months < p.stagnantMonths) return;
        push("Warehouses_Obsolete", i, months >= p.stagnantMonths * 3 ? "high" : "medium", `${ADV}تجاوز مدة الركود المعيارية`, `${txt(r.name) || txt(r.item_no)} — ركود ${months} شهراً${txt(r.writeoff) ? " رغم وجود قرار شطب" : " دون قرار"}`, num(r.book_value));
      });
    },
  },
  {
    id: "advances.replenishment",
    sector: "advances",
    command: 1,
    title: "انتظام استعاضة السلف المستديمة",
    run({ store, push, today, p }) {
      (store.Advances_Permanent_Petty ?? []).forEach((r, i) => {
        const approved = num(r.approved);
        const spent = num(r.spent);
        if (!approved || spent === undefined || spent < approved * 0.8) return;
        const rep = dateOf(r.replenish_date);
        if (rep !== undefined && (today - rep) / DAY <= p.reviewIntervalDays) return;
        push("Advances_Permanent_Petty", i, spent >= approved ? "high" : "medium", `${ADV}استعاضة السلفة المستديمة غير منتظمة`, `${txt(r.custodian)} — صُرف ${money(spent)} من ${money(approved)} ${rep === undefined ? "دون تاريخ استعاضة" : `وآخر استعاضة قبل ${Math.floor((today - rep) / DAY)} يوماً`}`, spent);
      });
    },
  },
  {
    id: "procurement.cumulativeCeiling",
    sector: "procurement",
    command: 0,
    title: "السقوف التراكمية لكل مورد خلال السنة المالية",
    run({ store, push, p }) {
      const rows = (store.Direct_Purchases_Orders ?? []).map((r, i) => ({ r, i, v: num(r.value) ?? 0, t: dateOf(r.date) })).filter((x) => x.t !== undefined && x.v > 0 && norm(x.r.supplier));
      groupBy(rows, (x) => `${norm(x.r.supplier)}|${new Date(x.t).getUTCFullYear()}`).forEach((list, key) => {
        const sorted = [...list].sort((a, b) => a.t - b.t || a.i - b.i);
        const total = sorted.reduce((a, x) => a + x.v, 0);
        const supplier = txt(sorted[0].r.supplier);
        const year = key.split("|")[1];
        if (p.directPurchaseCeiling > 0) {
          let run = 0;
          for (const x of sorted) {
            run += x.v;
            if (run > p.directPurchaseCeiling) {
              push("Direct_Purchases_Orders", x.i, "high", `${ADV}تجاوز السقف التراكمي للشراء المباشر لمورد`, `${supplier} — إجمالي ${year}: ${money(total)} مقابل سقف ${money(p.directPurchaseCeiling)}`, total - p.directPurchaseCeiling);
              break;
            }
          }
        }
      });
      // عند غياب السقف: تركّز المشتريات المباشرة على مورد واحد خلال السنة
      if (!(p.directPurchaseCeiling > 0)) {
        groupBy(rows, (x) => `${new Date(x.t).getUTCFullYear()}`).forEach((yearRows, year) => {
          const total = yearRows.reduce((a, x) => a + x.v, 0);
          groupBy(yearRows, (x) => norm(x.r.supplier)).forEach((l) => {
            const sum = l.reduce((a, x) => a + x.v, 0);
            const share = total ? (sum / total) * 100 : 0;
            if (l.length >= 3 && share >= p.concentrationPct)
              push("Direct_Purchases_Orders", l[0].i, share >= 50 ? "high" : "medium", `${ADV}تركّز المشتريات المباشرة على مورد واحد`, `${txt(l[0].r.supplier)} — ${share.toFixed(0)}% من مشتريات ${year} (${l.length} أوامر)`, sum);
          });
        });
      }
    },
  },
  {
    id: "procurement.splitting",
    sector: "procurement",
    command: 1,
    title: "تجزئة الشراء ضمن فترات متقاربة",
    run({ store, push, p }) {
      const rows = (store.Direct_Purchases_Orders ?? []).map((r, i) => ({ r, i, v: num(r.value) ?? 0, t: dateOf(r.date) })).filter((x) => x.t !== undefined && norm(x.r.supplier));
      groupBy(rows, (x) => norm(x.r.supplier)).forEach((list) => {
        const sorted = [...list].sort((a, b) => a.t - b.t);
        const flagged = new Set();
        for (let a = 0; a < sorted.length; a++) {
          const win = sorted.filter((x) => x.t >= sorted[a].t && x.t - sorted[a].t <= p.splitWindowDays * DAY);
          if (win.length < 2) continue;
          const sum = win.reduce((s, x) => s + x.v, 0);
          const trips = p.directPurchaseCeiling > 0 ? sum > p.directPurchaseCeiling && win.every((x) => x.v <= p.directPurchaseCeiling) : win.length >= 3;
          if (trips) win.forEach((x) => flagged.add(x.i));
        }
        sorted.filter((x) => flagged.has(x.i) && !rowsSameDay(sorted, x)).forEach((x) =>
          push("Direct_Purchases_Orders", x.i, "high", `${ADV}تجزئة أوامر شراء لمورد خلال ${p.splitWindowDays} أيام`, `${txt(x.r.supplier)} — ${money(x.v)} ضمن سلسلة أوامر متقاربة`, x.v),
        );
      });
    },
  },
  {
    id: "procurement.staffIsSupplier",
    sector: "procurement",
    command: 1,
    title: "مُدخل أو مستلم الشراء هو المورد نفسه",
    run({ store, push }) {
      (store.Direct_Purchases_Orders ?? []).forEach((r, i) => {
        const s = fullName(r.supplier);
        if (!s) return;
        if (fullName(r.entered_by) === s || fullName(r.received_by) === s)
          push("Direct_Purchases_Orders", i, "high", `${ADV}تقاطع: مُدخل أو مستلم أمر الشراء هو المورد`, txt(r.supplier), num(r.value));
      });
    },
  },
  {
    id: "tenders.committeeConflict",
    sector: "tenders",
    command: 0,
    title: "تعارض مصالح لجان العطاءات وتدوير الأعضاء",
    run({ store, push, p }) {
      const members = (r) => txt(r.committee).split(/[،,;؛/\n]|\sو\s|\s-\s/).map(norm).filter((m) => m.split(" ").length >= 2);
      const rows = (store.Tenders_Records ?? []).map((r, i) => ({ r, i, m: members(r) }));
      rows.forEach(({ r, i, m }) => {
        const win = fullName(r.winner);
        if (win && m.some((x) => x === win || x.includes(win) || win.includes(x)))
          push("Tenders_Records", i, "high", `${ADV}تعارض مصالح: عضو لجنة العطاءات هو الجهة المحال عليها`, `${txt(r.tender_no)} — ${txt(r.winner)}`, num(r.awarded_value));
      });
      const count = new Map();
      rows.forEach(({ m }) => new Set(m).forEach((x) => count.set(x, (count.get(x) ?? 0) + 1)));
      rows.forEach(({ r, i, m }) => {
        const repeated = [...new Set(m)].filter((x) => (count.get(x) ?? 0) >= p.committeeRotationMax);
        if (repeated.length)
          push("Tenders_Records", i, repeated.length >= 2 ? "high" : "medium", `${ADV}تكرار أعضاء لجان العطاءات دون تدوير`, `${repeated.join("، ")} — في ${p.committeeRotationMax} عطاءات فأكثر`, num(r.awarded_value));
      });
    },
  },
];

const rowsSameDay = (sorted, x) => sorted.some((y) => y.i !== x.i && y.t === x.t); // تغطيها قاعدة «نفس اليوم» القائمة

/** الاستعلامات مجمعة بحسب النشاط، مع بيانات تعريفية للواجهة. */
export const ADVANCED_QUERIES = queries.map(({ id, sector, command, title }) => ({ id, sector, command, title }));
export const queriesOfSector = (sector) => ADVANCED_QUERIES.filter((q) => q.sector === sector);

/**
 * تشغيل كل الاستعلامات. params مدمجة مع المعاملات الافتراضية لمحرك الفحص.
 * يستثني النشاط مُفعّلاً/معطلاً عبر only: مجموعة مفاتيح أنشطة (اختياري).
 */
export function advancedFindings(store, sectorOf, params = {}, today = Date.now()) {
  const p = { workStartHour: 7, workEndHour: 15, reviewIntervalDays: 90, directPurchaseCeiling: 0, splitWindowDays: 7, concentrationPct: 25, committeeRotationMax: 3, stagnantMonths: 12, overtimeConcentrationPct: 30, ...params };
  const out = [];
  const push = (dataset, row, severity, test, detail, amount) => {
    const f = { dataset, sector: sectorOf(dataset), row, severity, test, detail };
    if (Number.isFinite(amount)) f.amount = amount;
    out.push(f);
  };
  for (const q of queries) {
    try {
      q.run({ store, push, p, today });
    } catch {
      /* بيانات ناقصة أو مشوهة في جدول: لا يوقف بقية الاستعلامات */
    }
  }
  return out;
}
