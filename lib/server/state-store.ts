import type { PersistedAppState } from "@/lib/types";

const STATE_ID = "main";
const CREATE_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS app_state (
    id TEXT PRIMARY KEY NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT NOT NULL
  )
`;

async function database() {
  // Kept dynamic so the built Worker can still be inspected by Node during the
  // Sites artifact gate; the module is resolved only inside Cloudflare.
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  if (!db) throw new Error("El almacenamiento D1 no está disponible.");
  await db.prepare(CREATE_STATE_TABLE).run();
  return db;
}

export async function readAppState(): Promise<PersistedAppState | null> {
  const db = await database();
  const row = await db.prepare("SELECT payload FROM app_state WHERE id = ? LIMIT 1").bind(STATE_ID).first<{ payload: string }>();
  if (!row) return null;
  return JSON.parse(row.payload) as PersistedAppState;
}

export async function writeAppState(state: PersistedAppState, actor: string) {
  const db = await database();
  await db.prepare(`
    INSERT INTO app_state (id, schema_version, payload, updated_at, updated_by)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(id) DO UPDATE SET
      schema_version = excluded.schema_version,
      payload = excluded.payload,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = excluded.updated_by
  `).bind(STATE_ID, state.version, JSON.stringify(state), actor).run();
}
