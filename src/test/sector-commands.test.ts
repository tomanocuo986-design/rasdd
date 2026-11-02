import { beforeEach, describe, expect, it } from "vitest";
import { auditSectors } from "@/rasd/workspace.jsx";
import { SECTOR_COMMANDS } from "@/rasd/sector-commands.js";
import { loadCommands, dedupeCommands, addCommand } from "@/rasd/advanced";

const KEY = "rasd-sector-commands";
type Cmd = { id?: string; seedId?: string; title: string; text: string };
const S = SECTOR_COMMANDS as Record<string, Cmd[]>;
const titles = (l: Cmd[]) => l.map((c) => c.title);

const TABLES: Record<string, string[]> = {
  finance: ["Payment_Vouchers", "Adjustments", "Trial_Balance"],
  hr: ["HR_Payroll_Sheets", "HR_Leaves_Records", "HR_Overtime_Bonuses", "HR_Establishment_Table"],
  fleet: ["Fleet_Fuel_System_Logs", "Fleet_Station_Fuel_Statements", "Fleet_GPS_Tracking_Logs"],
  warehouses: ["Warehouses_Physical_Stocktaking", "Warehouse_Master_List", "Warehouses_Obsolete"],
  advances: ["Advances_Temporary", "Advances_Overdue_Outstanding", "Advances_Permanent_Petty"],
  procurement: ["Direct_Purchases_Orders"],
  tenders: ["Procurement_Tenders_Registry", "Tenders_Committees_Reception", "Tenders_Bank_Guarantees"],
};

describe("sector commands", () => {
  beforeEach(() => localStorage.clear());

  it("has exactly one advanced command per activity, each with its own tables only", () => {
    expect(Object.keys(S).sort()).toEqual(auditSectors.map((s) => s.key).sort());
    for (const [k, list] of Object.entries(S)) {
      expect(list).toHaveLength(1);
      expect(list[0]!.text).toContain("بصفتك");
      expect(list[0]!.text.match(/^\d\. /gm)).toHaveLength(2);
      for (const tb of TABLES[k]!) expect(list[0]!.text).toContain(tb);
    }
    const other = (k: string) => Object.entries(S).filter(([x]) => x !== k).map(([, l]) => l[0]!.text).join("\n");
    for (const [k, tbs] of Object.entries(TABLES)) for (const tb of tbs) expect(other(k)).not.toContain(`\`${tb}\``);
    expect(S.finance![0]!.text).toContain("التواريخ الشاذة");
    expect(S.procurement![0]!.text).toContain("تآكل السقوف التراكمية");
    expect(S.tenders![0]!.text).toContain("تعارض مصالح اللجان");
  });

  it("seeds a clean install once", () => {
    const { items } = loadCommands();
    for (const k of Object.keys(S)) expect(items[k]).toHaveLength(1);
    expect(loadCommands().items.finance).toHaveLength(1);
  });

  it("replaces the previous built-in commands for existing users and keeps their own", () => {
    const mine = { id: "m", title: "خاص", text: "افحص عقود الإيجار السنوية وقارنها بالسجل" };
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 3,
        seeded: { finance: ["base", "revenue"], tenders: ["base", "engineering"], hr: true },
        items: {
          finance: [
            { id: "a", seedId: "base", title: "الأمر التخصصي لنشاط المالية والمحاسبة", text: "بصفتك مدققاً مالياً خبيراً قديم" },
            { id: "b", seedId: "revenue", title: "الأمر التخصصي لنشاط الإيرادات والتحصيل", text: "بصفتك خبير تدقيق إيرادات وتحصيل قديم" },
            mine,
          ],
          tenders: [{ id: "c", seedId: "engineering", title: "الأمر التخصصي لنشاط المشاريع الهندسية", text: "قديم هندسي" }],
          hr: [{ id: "h", title: "الأمر التخصصي لنشاط الموارد البشرية والرواتب", text: "قديم موارد" }],
        },
      }),
    );
    const { items } = loadCommands();
    expect(titles(items.finance)).toEqual([S.finance![0]!.title, "خاص"]);
    expect(titles(items.tenders)).toEqual([S.tenders![0]!.title]);
    expect(titles(items.hr)).toEqual([S.hr![0]!.title]);
    expect(titles(loadCommands().items.finance)).toHaveLength(2);
  });

  it("keeps a deleted built-in deleted", () => {
    loadCommands();
    const st = JSON.parse(localStorage.getItem(KEY)!);
    st.items.hr = [];
    localStorage.setItem(KEY, JSON.stringify(st));
    expect(loadCommands().items.hr).toHaveLength(0);
  });

  it("treats near-identical commands as repeats but not different ones", () => {
    const base = S.hr![0]!.text;
    expect(dedupeCommands([{ text: base }, { text: base + " ." }] as Cmd[])).toHaveLength(1);
    expect(addCommand({ hr: [{ id: "1", title: "t", text: base }] }, "hr", "", base + "  ").ok).toBe(false);
    expect(dedupeCommands([{ text: base }, { text: S.fleet![0]!.text }] as Cmd[])).toHaveLength(2);
  });
});
