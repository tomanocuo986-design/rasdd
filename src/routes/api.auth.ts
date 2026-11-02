import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth")({
  server: {
    handlers: {
      GET: async ({ request }) => (await import("../server/auth.ts")).handleGet(request),
      POST: async ({ request }) => (await import("../server/auth.ts")).handlePost(request),
    },
  },
});
