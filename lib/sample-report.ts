import type { VeRequest } from "@/lib/types";

export type SampleReportRow = {
  Producto: string;
  "Descripción": string;
  Lote: string;
  Corte: string;
  "PIN°": string;
  Solicitud: string;
};

const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");

/**
 * Genera una sola muestra por vino, lote y corte. Una solicitud puede contener
 * varias asignaciones provenientes de distintos CB de la misma estiba; esos CB
 * no deben producir filas repetidas en el reporte de laboratorio.
 */
export function buildSampleReportRows(requests: VeRequest[]): SampleReportRow[] {
  const rows = new Map<string, SampleReportRow & { pins: Set<string>; requests: Set<string> }>();

  for (const request of requests) {
    const groups = request.allocations?.length
      ? request.allocations
      : [{ productCode: request.productCode, product: request.brand, lot: request.lots.join(" / "), cut: request.cut }];

    for (const item of groups) {
      const key = [item.productCode, item.product, item.lot, item.cut].map(normalize).join("|");
      const existing = rows.get(key);
      if (existing) {
        if (request.pn) existing.pins.add(request.pn.trim());
        if (request.number) existing.requests.add(request.number.trim());
        continue;
      }

      rows.set(key, {
        Producto: String(item.productCode ?? "").trim(),
        "Descripción": String(item.product ?? "").trim(),
        Lote: String(item.lot ?? "").trim(),
        Corte: String(item.cut ?? "").trim(),
        "PIN°": "",
        Solicitud: "",
        pins: new Set(request.pn ? [request.pn.trim()] : []),
        requests: new Set(request.number ? [request.number.trim()] : []),
      });
    }
  }

  return [...rows.values()].map(({ pins, requests, ...row }) => ({
    ...row,
    "PIN°": [...pins].join(" / "),
    Solicitud: [...requests].join(" / "),
  }));
}
