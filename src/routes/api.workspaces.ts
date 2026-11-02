import { createFileRoute } from "@tanstack/react-router";
import { loadKeyRing } from "../server/field-crypto.ts";
import { handleWorkspaces, memoryRepo, parseTokens, type Deps, type Repo } from "../server/workspaces.ts";

let cached: Deps | { error: string } | undefined;
let memory: Repo | undefined;

async function deps(): Promise<Deps | { error: string }> {
  if (cached) return cached;
  const tokens = parseTokens(process.env["RASD_API_TOKENS"]);
  if (!tokens.size) return { error: "المزامنة غير مفعّلة: لم تُضبط RASD_API_TOKENS على الخادم." };
  let ring;
  try {
    ring = loadKeyRing();
  } catch (e) {
    console.error("workspaces: key ring", e instanceof Error ? e.message : e);
    return { error: "المزامنة غير مفعّلة: مفتاح التشفير RASD_DATA_KEY غير مضبوط أو غير صالح." };
  }
  let repo: Repo;
  if (process.env["DATABASE_URL"]) repo = (await import("../server/pg-repo.ts")).pgRepo();
  else if (process.env["RASD_ALLOW_MEMORY_STORE"] === "1") repo = memory ??= memoryRepo();
  else return { error: "المزامنة غير مفعّلة: لم يُضبط DATABASE_URL على الخادم." };
  cached = {
    repo,
    ring,
    tokens,
    maxPayloadBytes: Number(process.env["RASD_MAX_PAYLOAD_MB"] ?? 25) * 1024 * 1024,
  };
  return cached;
}

async function run(request: Request) {
  const d = await deps();
  if ("error" in d)
    return new Response(JSON.stringify({ error: d.error }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  return handleWorkspaces(request, d);
}

export const Route = createFileRoute("/api/workspaces")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => run(request),
      PUT: ({ request }: { request: Request }) => run(request),
      DELETE: ({ request }: { request: Request }) => run(request),
    },
  },
});
