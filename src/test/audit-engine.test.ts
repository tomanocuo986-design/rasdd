import { describe, expect, it } from "vitest";
import * as engine from "@/rasd/audit-engine.js";
import * as ws from "@/rasd/workspace.jsx";
import { buildDemoStore, DEMO_PARAMS } from "@/rasd/demo-data.js";

const T = Date.parse("2026-11-01");

describe("audit-engine.js (extracted from workspace.jsx)", () => {
  it("workspace.jsx re-exports the very same engine objects, so older imports keep working", () => {
    expect(ws.runAudit).toBe(engine.runAudit);
    expect(ws.auditSectors).toBe(engine.auditSectors);
    expect(ws.allDatasets).toBe(engine.allDatasets);
  });

  it("exports the engine surface", () => {
    expect(typeof engine.runAudit).toBe("function");
    expect(Array.isArray(engine.auditSectors)).toBe(true);
    expect(engine.allDatasets.length).toBeGreaterThan(0);
    expect(typeof engine.defaultParams).toBe("object");
  });

  it("runs on its own: demo data yields findings and an empty store yields none", () => {
    expect(engine.runAudit(buildDemoStore(T), T, DEMO_PARAMS).length).toBeGreaterThan(0);
    expect(engine.runAudit({}, T, {})).toEqual([]);
  });
});
