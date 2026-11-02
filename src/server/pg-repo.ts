// PostgreSQL implementation of the workspace repo (DATABASE_URL). Values arrive already encrypted (field-crypto.ts),
// so the database, its backups and its admins only ever see ciphertext for names and payloads.
import type { PutResult, Repo, Row } from "./workspaces.ts";

type Pool = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }> };

let poolPromise: Promise<Pool> | undefined;

async function getPool(): Promise<Pool> {
  poolPromise ??= (async () => {
    // @ts-ignore - `pg` is a runtime dependency (listed in package.json)
    const { default: pg } = await import("pg");
    const ssl = process.env["DATABASE_SSL"] === "require" ? { rejectUnauthorized: false } : undefined;
    const pool: Pool = new pg.Pool({
      connectionString: process.env["DATABASE_URL"],
      max: Number(process.env["DATABASE_POOL_MAX"] ?? 10),
      ssl,
    });
    await pool.query(`
      create table if not exists rasd_workspaces (
        owner       text        not null,
        id          text        not null,
        name_enc    text        not null,
        payload_enc text        not null,
        version     integer     not null default 1,
        updated_at  timestamptz not null default now(),
        primary key (owner, id)
      )`);
    return pool;
  })();
  return poolPromise;
}

const toRow = (r: any): Row => ({
  id: r.id,
  nameEnc: r.name_enc,
  payloadEnc: r.payload_enc,
  version: r.version,
  updatedAt: new Date(r.updated_at).toISOString(),
});

export function pgRepo(): Repo {
  return {
    async list(owner) {
      const p = await getPool();
      const { rows } = await p.query(
        "select id, name_enc, version, updated_at from rasd_workspaces where owner = $1 order by updated_at desc",
        [owner],
      );
      return rows.map((r) => ({
        id: r.id,
        nameEnc: r.name_enc,
        version: r.version,
        updatedAt: new Date(r.updated_at).toISOString(),
      }));
    },
    async get(owner, id) {
      const p = await getPool();
      const { rows } = await p.query("select * from rasd_workspaces where owner = $1 and id = $2", [owner, id]);
      return rows[0] ? toRow(rows[0]) : null;
    },
    async put(owner, id, nameEnc, payloadEnc, baseVersion): Promise<PutResult> {
      const p = await getPool();
      const q =
        baseVersion === 0
          ? await p.query(
              `insert into rasd_workspaces (owner, id, name_enc, payload_enc) values ($1,$2,$3,$4)
               on conflict do nothing returning version`,
              [owner, id, nameEnc, payloadEnc],
            )
          : await p.query(
              `update rasd_workspaces set name_enc=$3, payload_enc=$4, version=version+1, updated_at=now()
               where owner=$1 and id=$2 and version=$5 returning version`,
              [owner, id, nameEnc, payloadEnc, baseVersion],
            );
      if (q.rows[0]) return { ok: true, version: q.rows[0].version };
      const cur = await p.query("select version from rasd_workspaces where owner=$1 and id=$2", [owner, id]);
      return { ok: false, current: cur.rows[0]?.version ?? 0 };
    },
    async remove(owner, id) {
      const p = await getPool();
      const r = await p.query("delete from rasd_workspaces where owner=$1 and id=$2 returning id", [owner, id]);
      return r.rows.length > 0;
    },
  };
}

export async function pingDb(): Promise<boolean> {
  try {
    await (await getPool()).query("select 1");
    return true;
  } catch {
    return false;
  }
}
