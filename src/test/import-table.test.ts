import { describe, expect, it } from "vitest";
import * as X from "xlsx";
import { allDatasets } from "@/rasd/workspace.jsx";
import { mapWorkbook, normText, rowsFromAoa } from "@/rasd/import-table.js";

const orders = allDatasets.find((d) => d.key === "Fleet_Movement_Orders")!;
const fuel = allDatasets.find((d) => d.key === "Fleet_Fuel_System_Logs")!;

function book() {
  const wb = X.utils.book_new();
  // title rows above the table, sloppy header spelling, Arabic digits, Excel date serials (a JS Date cell would depend on the machine time zone)
  const a = X.utils.aoa_to_sheet([
    ["تقرير أوامر الحركة 2025"],
    [],
    ["رقم امر الحركة", " تاريخ الخروج ", "اسم السائق", "رقم الالية", "خط سير الرحلة", "الغرض الرسمي"],
    ["١٠١", 45662, "أحمد", "٤٥٦٧", "عمان - اربد", "مهمة"],
    ["102", 45667, "خالد", "4568", "عمان - الزرقاء", "مهمة"],
  ]);
  a["B4"].z = "dd/mm/yyyy";
  a["B5"].z = "yyyy-mm-dd";
  X.utils.book_append_sheet(wb, a, "Sheet1");
  // sheet named exactly like the dataset key, numbers with thousands separators
  const b = X.utils.aoa_to_sheet([
    ["رقم الآلية", "كمية المحروقات (نظام المحروقات)", "قراءة العداد عند التعبئة"],
    ["4567", "1,250.5", 120000],
  ]);
  X.utils.book_append_sheet(wb, b, "Fleet_Fuel_System_Logs");
  const c = X.utils.aoa_to_sheet([["foo", "bar"], [1, 2]]);
  X.utils.book_append_sheet(wb, c, "Junk");
  return wb;
}

describe("import-table", () => {
  it("normalizes Arabic variants", () => {
    expect(normText("رقم أمر الحركة")).toBe(normText("رقم امر الحركه"));
    expect(normText("٤٥٦")).toBe("456");
  });

  it("maps all sheets to datasets, even with title rows and loose headers", () => {
    const { imports, unmatched } = mapWorkbook(X, book(), allDatasets as any, "Direct_Purchases_Orders");
    const o = imports.find((i) => i.key === orders.key)!;
    expect(o.rows).toHaveLength(2);
    expect(o.rows[0].order_no).toBe("101");
    expect(o.rows[0].vehicle).toBe("4567");
    expect(o.rows[0].date).toBe("2025-01-05");
    expect(o.rows[1].date).toBe("2025-01-10");
    const f = imports.find((i) => i.key === fuel.key)!;
    expect(f.rows[0].odometer).toBe("120000");
    expect(unmatched.map((u) => u.sheet)).toEqual(["Junk"]);
  });

  it("reads csv-like arrays through the same matcher", () => {
    const r = rowsFromAoa([["رقم الآلية", "قراءة العداد عند التعبئة"], ["1", "5"]], fuel.fields);
    expect(r.rows[0].vehicle).toBe("1");
  });
});
