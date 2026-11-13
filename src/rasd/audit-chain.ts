export type AuditEvent = {
  seq: number;
  ts: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  detail: string;
  prevHash: string;
  hash: string;
};

export type ChainVerdict =
  { ok: true; count: number } | { ok: false; brokenAt: number; reason: string };

export type Standing = "valid" | "broken" | "after";

export function standingOf(seq: number, verify: ChainVerdict): Standing {
  if (verify.ok) return "valid";
  if (seq < verify.brokenAt) return "valid";
  return seq === verify.brokenAt ? "broken" : "after";
}
