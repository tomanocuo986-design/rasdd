import { createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/AuthGate";
import { AuditTrailPanel } from "@/rasd/AuditTrailPanel";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [{ title: "رصد | سجل التدقيق" }],
  }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <AuthGate>
      <AuditTrailPanel />
    </AuthGate>
  );
}
