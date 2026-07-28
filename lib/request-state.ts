import { restoreRequestConsumption } from "./allocations";
import type { AuditEntry, PersistedAppState, ProductionOrder, VeRequest } from "./types";

export type RequestCommitConfirmation = {
  requestId: string;
  requestNumber: string;
  stockDeductedBottles: number;
  orderCompleted: boolean;
};

export class RequestCommitError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
    public readonly code = "REQUEST_COMMIT_FAILED",
  ) {
    super(message);
    this.name = "RequestCommitError";
  }
}

export function commitVeRequest(
  state: PersistedAppState,
  request: VeRequest,
  actor: string,
): { state: PersistedAppState; confirmation: RequestCommitConfirmation } {
  if (state.requests.some(item => item.id === request.id || item.number === request.number)) {
    throw new RequestCommitError(
      "La solicitud ya existe. Actualice el historial antes de volver a generarla.",
      409,
      "DUPLICATE_REQUEST",
    );
  }

  const allocations = request.allocations ?? [];
  if (!allocations.length) {
    throw new RequestCommitError(
      "La solicitud no tiene estibas asignadas.",
      400,
      "MISSING_ALLOCATIONS",
    );
  }

  const usedByStack = new Map<string, number>();
  for (const allocation of allocations) {
    const quantity = Number(allocation.usedBottles);
    if (!allocation.stackId || !Number.isFinite(quantity) || quantity <= 0) {
      throw new RequestCommitError(
        "La distribución de botellas contiene una estiba inválida.",
        400,
        "INVALID_ALLOCATION",
      );
    }
    usedByStack.set(allocation.stackId, (usedByStack.get(allocation.stackId) ?? 0) + quantity);
  }

  const stackById = new Map(state.stacks.map(stack => [stack.id, stack]));
  for (const [stackId, quantity] of usedByStack) {
    const stack = stackById.get(stackId);
    if (!stack) {
      throw new RequestCommitError(
        "El reporte de estibas cambió. Actualícelo y vuelva a seleccionar el stock.",
        409,
        "STACK_NOT_FOUND",
      );
    }
    if (stack.availableQuantity < quantity) {
      throw new RequestCommitError(
        `La estiba ${stack.productCode} · ${stack.lot} ya no tiene stock suficiente. Actualice el stock y vuelva a seleccionarla.`,
        409,
        "INSUFFICIENT_STACK_STOCK",
      );
    }
  }

  const matchingOrders = state.orders.filter(order => sameOrder(order, request));
  if (!matchingOrders.length) {
    throw new RequestCommitError(
      "El pedido cambió en la programación. Actualice Pedidos y vuelva a seleccionarlo.",
      409,
      "ORDER_NOT_FOUND",
    );
  }

  let stockDeductedBottles = 0;
  const stacks = state.stacks.map(stack => {
    const consumed = usedByStack.get(stack.id) ?? 0;
    if (!consumed) return stack;
    stockDeductedBottles += consumed;
    const availableQuantity = stack.availableQuantity - consumed;
    const existingConsumptions = Array.isArray(stack.extraData.consumptions)
      ? stack.extraData.consumptions
      : [];
    const reportedQuantity = numericValue(
      stack.extraData.reportedQuantity,
      stack.originalQuantity,
      stack.availableQuantity,
    );
    return {
      ...stack,
      used: availableQuantity === 0,
      availableQuantity,
      extraData: {
        ...stack.extraData,
        reportedQuantity,
        consumptions: [
          ...existingConsumptions,
          { requestNumber: request.number, pn: request.pn, bottles: consumed },
        ],
        totalConsumed: numericValue(stack.extraData.totalConsumed, 0) + consumed,
      },
    };
  });

  const nextState: PersistedAppState = {
    ...state,
    stacks,
    requests: [request, ...state.requests],
    orders: state.orders.map(order => sameOrder(order, request)
      ? { ...order, veCompleted: true, highlightedNew: false }
      : order),
    audit: [
      auditEntry(
        actor,
        "Generación",
        "Solicitud VE",
        `${request.number} · ${request.client} · ${stockDeductedBottles} botellas descontadas`,
      ),
      ...state.audit,
    ],
  };

  return {
    state: nextState,
    confirmation: {
      requestId: request.id,
      requestNumber: request.number,
      stockDeductedBottles,
      orderCompleted: true,
    },
  };
}

export function deleteVeRequest(
  state: PersistedAppState,
  requestId: string,
  actor: string,
): PersistedAppState {
  const request = state.requests.find(item => item.id === requestId);
  if (!request) {
    throw new RequestCommitError(
      "La solicitud ya no existe. Actualice el historial.",
      404,
      "REQUEST_NOT_FOUND",
    );
  }
  const remainingRequests = state.requests.filter(item => item.id !== requestId);
  const orderStillCompleted = remainingRequests.some(item => sameRequestOrder(item, request));
  return {
    ...state,
    stacks: restoreRequestConsumption(state.stacks, request),
    requests: remainingRequests,
    orders: state.orders.map(order => sameOrder(order, request)
      ? {
          ...order,
          veCompleted: orderStillCompleted,
          highlightedNew: orderStillCompleted ? false : true,
        }
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

export function sameOrder(order: ProductionOrder, request: VeRequest) {
  if (request.sourceOrderId && order.id === request.sourceOrderId) return true;
  return canonical(order.pn) === canonical(request.pn)
    && canonical(order.internalCode) === canonical(request.productCode);
}

function sameRequestOrder(left: VeRequest, right: VeRequest) {
  if (left.sourceOrderId && right.sourceOrderId) return left.sourceOrderId === right.sourceOrderId;
  return canonical(left.pn) === canonical(right.pn)
    && canonical(left.productCode) === canonical(right.productCode);
}

function auditEntry(actor: string, action: string, entity: string, detail: string): AuditEntry {
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), actor, action, entity, detail };
}

function numericValue(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function canonical(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
