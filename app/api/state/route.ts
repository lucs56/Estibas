import { mutateAppState, readAppStateSnapshot, StateConflictError, writeAppState } from "@/lib/server/state-store";
import { restoreRequestConsumption } from "@/lib/allocations";
import type { AuditEntry, PersistedAppState, VeRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

function isValidState(value: unknown): value is PersistedAppState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<PersistedAppState>;
  return state.version === 5 && Array.isArray(state.stacks) && Array.isArray(state.lots)
    && Array.isArray(state.orders) && Array.isArray(state.requests)
    && Array.isArray(state.users) && Array.isArray(state.audit)
    && Boolean(state.catalogs && typeof state.catalogs === "object" && Object.values(state.catalogs).every(Array.isArray))
    && Boolean(state.settings && typeof state.settings === "object")
    && state.stacks.length <= 50_000 && state.lots.length <= 20_000;
}

export async function GET() {
  try {
    const snapshot = await readAppStateSnapshot();
    return Response.json(snapshot, { headers: { "cache-control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo leer el estado." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { state?: unknown; baseRevision?: unknown; actor?: unknown };
    if (!isValidState(body.state) || !Number.isInteger(body.baseRevision) || Number(body.baseRevision) < 0) {
      return Response.json({ error: "Actualice la página: esta versión ya no admite guardados sin control de cambios." }, { status: 409 });
    }
    const snapshot = await writeAppState(body.state, stringValue(body.actor, "internal-user"), Number(body.baseRevision));
    return Response.json({ ok: true, ...snapshot });
  } catch (error) {
    if (error instanceof StateConflictError) {
      return Response.json({ error: error.message, ...error.latest }, { status: 409 });
    }
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar el estado." }, { status: 500 });
  }
}

type MutationBody =
  | { action: "createRequest"; request: VeRequest; actor?: string }
  | { action: "deleteRequest"; requestId: string; actor?: string }
  | { action: "setRequestSamples"; changes: Array<{ id: string; samplesPrepared: boolean }>; actor?: string };

export async function POST(request: Request) {
  try {
    const body = await request.json() as MutationBody;
    const actor = stringValue(body.actor, "internal-user");
    if (body.action === "createRequest" && validRequest(body.request)) {
      const snapshot = await mutateAppState(actor, state => addRequest(state, body.request, actor));
      return Response.json({ ok: true, ...snapshot });
    }
    if (body.action === "deleteRequest" && typeof body.requestId === "string") {
      const snapshot = await mutateAppState(actor, state => removeRequest(state, body.requestId, actor));
      return Response.json({ ok: true, ...snapshot });
    }
    if (body.action === "setRequestSamples" && Array.isArray(body.changes)) {
      const changes = new Map(body.changes.filter(item => item && typeof item.id === "string")
        .map(item => [item.id, Boolean(item.samplesPrepared)]));
      const snapshot = await mutateAppState(actor, state => ({
        ...state,
        requests: state.requests.map(item => changes.has(item.id)
          ? { ...item, samplesPrepared: changes.get(item.id) }
          : item),
      }));
      return Response.json({ ok: true, ...snapshot });
    }
    return Response.json({ error: "La operación solicitada no es válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el historial." }, { status: 500 });
  }
}

function addRequest(state: PersistedAppState, request: VeRequest, actor: string): PersistedAppState {
  if (state.requests.some(item => item.id === request.id || item.number === request.number)) return state;
  const used = new Map((request.allocations ?? []).map(item => [item.stackId, item.usedBottles]));
  const stacks = state.stacks.map(stack => {
    const consumed = used.get(stack.id) ?? 0;
    if (!consumed) return stack;
    const availableQuantity = Math.max(0, stack.availableQuantity - consumed);
    return {
      ...stack,
      used: availableQuantity === 0,
      availableQuantity,
      extraData: {
        ...stack.extraData,
        consumptions: [
          ...((stack.extraData.consumptions as unknown[]) ?? []),
          { requestNumber: request.number, pn: request.pn, bottles: consumed },
        ],
      },
    };
  });
  return {
    ...state,
    stacks,
    requests: [request, ...state.requests],
    orders: state.orders.map(order => order.pn === request.pn && order.internalCode === request.productCode
      ? { ...order, veCompleted: true, highlightedNew: false }
      : order),
    audit: [auditEntry(actor, "Generación", "Solicitud VE", `${request.number} · ${request.client}`), ...state.audit],
  };
}

function removeRequest(state: PersistedAppState, requestId: string, actor: string): PersistedAppState {
  const request = state.requests.find(item => item.id === requestId);
  if (!request) return state;
  return {
    ...state,
    stacks: restoreRequestConsumption(state.stacks, request),
    requests: state.requests.filter(item => item.id !== requestId),
    orders: state.orders.map(order => order.pn === request.pn && order.internalCode === request.productCode
      ? { ...order, veCompleted: false, highlightedNew: true }
      : order),
    audit: [
      auditEntry(
        actor,
        "Eliminación",
        "Solicitud VE",
        `${request.number}; ${(request.allocations ?? []).reduce((total, item) => total + item.usedBottles, 0)} botellas recuperadas`,
      ),
      ...state.audit,
    ],
  };
}

function auditEntry(actor: string, action: string, entity: string, detail: string): AuditEntry {
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), actor, action, entity, detail };
}

function validRequest(value: unknown): value is VeRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<VeRequest>;
  return typeof request.id === "string" && typeof request.number === "string"
    && typeof request.productCode === "string" && Array.isArray(request.allocations);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
