import { readAppState, writeAppState } from "@/lib/server/state-store";
import type { PersistedAppState } from "@/lib/types";

export const dynamic = "force-dynamic";

function isValidState(value: unknown): value is PersistedAppState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PersistedAppState>;
  return state.version === 4 && Array.isArray(state.stacks) && Array.isArray(state.lots)
    && Array.isArray(state.orders) && Array.isArray(state.requests)
    && Array.isArray(state.users) && Array.isArray(state.audit)
    && Boolean(state.catalogs && typeof state.catalogs === "object" && Object.values(state.catalogs).every(Array.isArray))
    && Boolean(state.settings && typeof state.settings === "object")
    && state.stacks.length <= 50_000 && state.lots.length <= 20_000;
}

export async function GET() {
  try {
    return Response.json({ state: await readAppState() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo leer el estado." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isValidState(body)) return Response.json({ error: "El estado enviado no es válido." }, { status: 400 });
    await writeAppState(body, "internal-user");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar el estado." }, { status: 500 });
  }
}
