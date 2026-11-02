import { describe, expect, it } from "vitest";
import { runAudit } from "@/rasd/workspace.jsx";
import { addCommand, dedupeCommands, FLEET_COMMAND } from "@/rasd/advanced";

const T = Date.parse("2026-10-24");
const tests = (store: Record<string, Record<string, string>[]>, sector = "fleet") =>
  runAudit(store, T, {})
    .filter((f: { sector: string }) => f.sector === sector)
    .map((f: { test: string; severity: string }) => `${f.severity}|${f.test}`);

describe("fleet three-way fuel match", () => {
  const store = {
    Fleet_Movement_Orders: [{ order_no: "1", date: "2026-10-20", vehicle: "A1", driver: "x", purpose: "y" }],
    Fleet_GPS_Tracking_Logs: [{ vehicle: "A1", datetime: "2026-10-20 09:00", off_hours: "لا" }],
    Fleet_Fuel_System_Logs: [{ vehicle: "A1", liters: "100" }, { vehicle: "B2", liters: "50" }],
    Fleet_Station_Fuel_Statements: [
      { vehicle: "A1", datetime: "2026-10-20 09:30", liters: "130", unit_price: "0.9", contract_price: "0.8", amount: "117", invoice_no: "F1" },
      { vehicle: "C3", datetime: "2026-10-23 22:00", liters: "40", unit_price: "0.8", amount: "32", invoice_no: "F2" },
    ],
  };
  const out = tests(store);
  it("flags quantity gap between system and station", () =>
    expect(out).toContain("high|فرق كمية بين نظام المحروقات وكشف المحطة"));
  it("flags price above contract", () =>
    expect(out).toContain("high|سعر اللتر في فاتورة المحطة يخالف سعر العقد"));
  it("flags fills without a movement order and off-hours dispensing", () => {
    expect(out).toContain("high|تعبئة في المحطة بلا أمر حركة (تعبئة وهمية محتملة)");
    expect(out).toContain("medium|صرف محروقات خارج الدوام الرسمي");
  });
  it("flags system dispensing not confirmed by the station", () =>
    expect(out).toContain("medium|صرف في النظام الداخلي غير مؤكد بكشف المحطة"));
  it("does not leak fleet findings into other activities", () =>
    expect(tests(store, "cash")).toHaveLength(0));
});

describe("fleet licensing and maintenance", () => {
  it("flags expired insurance policy and licence about to expire", () => {
    const out = tests({
      Fleet_Licensing_Insurance: [
        { plate: "A1", prev_expiry: "2026-11-05", insurance_expiry: "2026-09-01" },
      ],
    });
    expect(out).toContain("high|بوليصة تأمين منتهية");
    expect(out).toContain("medium|رخصة آلية تقترب من الانتهاء");
  });
  it("flags inflated maintenance cost against the fleet median", () => {
    const row = (v: string, c: string, i: number) => ({ vehicle: v, date: `2026-0${i + 1}-01`, description: `d${i}`, parts_cost: c, invoice_no: `I${i}`, workshop: "w" });
    const out = tests({
      Fleet_Maintenance: [row("A", "100", 0), row("B", "110", 1), row("C", "90", 2), row("D", "5000", 3)],
    });
    expect(out.some((x) => x.includes("تضخم تكلفة صيانة"))).toBe(true);
  });
});

describe("activity commands", () => {
  it("adds a command to one activity only and rejects repeats", () => {
    const a = addCommand({}, "fleet", "t", "افحص المحروقات");
    expect(a.ok).toBe(true);
    expect(a.items.cash).toBeUndefined();
    expect(addCommand(a.items, "fleet", "", "افحص  المحروقات!").ok).toBe(false);
    expect(addCommand(a.items, "cash", "", "افحص المحروقات").ok).toBe(true);
  });
  it("removes repeated commands and keeps order", () => {
    const l = dedupeCommands([{ text: "أ ب" }, { text: "ج" }, { text: "أ  ب" }]);
    expect(l.map((c: { text: string }) => c.text)).toEqual(["أ ب", "ج"]);
  });
  it("ships the specialised fleet command with its four steps", () => {
    expect(FLEET_COMMAND.text).toContain("Fleet_Station_Fuel_Statements");
    expect(FLEET_COMMAND.text.match(/^\d\. /gm)).toHaveLength(2);
  });
});
