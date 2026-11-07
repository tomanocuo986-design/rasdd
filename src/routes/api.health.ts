import { createFileRoute } from "@tanstack/react-router";
import { aiStatus } from "../server/ai-policy.ts";

// Liveness/readiness probe for load balancers and uptime monitors (ALB / Azure App Service / Docker healthcheck).
// Keeps the instance warm when pinged and reports whether the optional database is reachable.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        let db: "off" | "up" | "down" = "off";
        if (process.env["DATABASE_URL"]) {
          const { pingDb } = await import("../server/pg-repo.ts");
          db = (await pingDb()) ? "up" : "down";
        }
        return new Response(JSON.stringify({ status: db === "down" ? "degraded" : "ok", db, ai: aiStatus() }), {
          status: db === "down" ? 503 : 200,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
