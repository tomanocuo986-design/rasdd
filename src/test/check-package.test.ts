import { describe, expect, it } from "vitest";
import { missingScriptFiles } from "../../scripts/check-package.mjs";

describe("missingScriptFiles", () => {
  const has = (set: string[]) => (p: string) => set.includes(p);
  it("يكشف ملفاً غير موجود في سكربت node", () => {
    const pkg = { scripts: { start: "node start.mjs", build: "vite build", off: "node scripts/a.mjs --x && node b.js" } };
    expect(missingScriptFiles(pkg, has(["scripts/a.mjs"]))).toEqual([
      { script: "start", file: "start.mjs" },
      { script: "off", file: "b.js" },
    ]);
  });
  it("لا يشتكي إن وُجدت الملفات", () => {
    expect(missingScriptFiles({ scripts: { start: "node start.mjs" } }, has(["start.mjs"]))).toEqual([]);
  });
});
