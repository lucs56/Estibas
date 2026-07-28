import type { PersistedAppState } from "@/lib/types";

const STATE_ID = "main";
const CREATE_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS app_state (
    id TEXT PRIMARY KEY NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0
  )
`;

export type AppStateSnapshot = {
  state: PersistedAppState | null;
  revision: number;
};

export class StateConflictError extends Error {
  constructor(public readonly latest: AppStateSnapshot) {
    super("El estado cambió en otro dispositivo.");
    this.name = "StateConflictError";
  }
}

let schemaPromise: Promise<void> | null = null;

async function database() {
  // Kept dynamic so the built Worker can still be inspected by Node during the
  // Sites artifact gate; the module is resolved only inside Cloudflare.
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  if (!db) throw new Error("El almacenamiento D1 no está disponible.");
  schemaPromise ??= (async () => {
    await db.prepare(CREATE_STATE_TABLE).run();
    try {
      await db.prepare("ALTER TABLE app_state ADD COLUMN revision INTEGER NOT NULL DEFAULT 0").run();
    } catch (error) {
      if (!(error instanceof Error) || !/duplicate column|already exists/i.test(error.message)) throw error;
    }
  })();
  await schemaPromise;
  return db;
}

export async function readAppState(): Promise<PersistedAppState | null> {
  return (await readAppStateSnapshot()).state;
}

export async function readAppStateSnapshot(): Promise<AppStateSnapshot> {
  const db = await database();
  const row = await db.prepare("SELECT payload, revision FROM app_state WHERE id = ? LIMIT 1")
    .bind(STATE_ID).first() as { payload: string; revision: number } | null;
  if (!row) return { state: null, revision: 0 };
  return { state: JSON.parse(row.payload) as PersistedAppState, revision: Number(row.revision ?? 0) };
}

export async function writeAppState(state: PersistedAppState, actor: string, expectedRevision: number) {
  const db = await database();
  const payload = JSON.stringify(state);
  if (expectedRevision === 0) {
    const inserted = await db.prepare(`
      INSERT OR IGNORE INTO app_state (id, schema_version, payload, updated_at, updated_by, revision)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 1)
    `).bind(STATE_ID, state.version, payload, actor).run();
    if (Number(inserted.meta?.changes ?? 0) === 1) return { state, revision: 1 };
    throw new StateConflictError(await readAppStateSnapshot());
  }

  const updated = await db.prepare(`
    UPDATE app_state
    SET schema_version = ?, payload = ?, updated_at = CURRENT_TIMESTAMP,
        updated_by = ?, revision = revision + 1
    WHERE id = ? AND revision = ?
  `).bind(state.version, payload, actor, STATE_ID, expectedRevision).run();
  if (Number(updated.meta?.changes ?? 0) !== 1) throw new StateConflictError(await readAppStateSnapshot());
  return { state, revision: expectedRevision + 1 };
}

export async function mutateAppState(
  actor: string,
  mutate: (state: PersistedAppState) => PersistedAppState,
): Promise<AppStateSnapshot> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await readAppStateSnapshot();
    if (!current.state) throw new Error("Todavía no existe un estado compartido para modificar.");
    try {
      return await writeAppState(mutate(current.state), actor, current.revision);
    } catch (error) {
      if (!(error instanceof StateConflictError) || attempt === 4) throw error;
    }
  }
  throw new Error("No se pudo guardar porque el estado cambió repetidamente.");
}
