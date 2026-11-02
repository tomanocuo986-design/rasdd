import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const entry = resolve(".output/server/index.mjs");

process.env.npm_config_cache ??= "/tmp/npm-cache";
process.env.PORT ??= process.env.SERVER_PORT || "3000";
process.env.NITRO_PORT ??= process.env.PORT;
process.env.HOST ??= "0.0.0.0";
process.env.NITRO_HOST ??= process.env.HOST;

if (!existsSync(entry)) {
  const r = spawnSync("npx", ["vite", "build"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, NITRO_PRESET: "node-server" },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(entry)) {
  console.error("Build failed: .output/server/index.mjs not found");
  process.exit(1);
}

await import(pathToFileURL(entry).href);
