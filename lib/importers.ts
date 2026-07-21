"use client";

import * as XLSX from "xlsx";
import { lotDateFromCode, toIsoDate } from "./expiry";
import type { LotDate, StackRecord } from "./types";

type CanonicalField =
  | "barcode" | "pallet" | "productionOrder" | "line" | "productCode" | "product"
  | "originalQuantity" | "availableQuantity" | "fractionationDate" | "location"
  | "sourceStatus" | "lot" | "cut" | "client" | "country" | "variety" | "harvest";

// Aliases are configuration, not column positions. New source labels can be added here
// without changing the parser or the rest of the application.
export const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  barcode: ["codigo de barra", "codigo barra", "barcode", "cod barra"],
  pallet: ["nro de pallet", "nro pallet", "pallet", "palet", "numero pallet"],
  productionOrder: ["orden p", "orden produccion", "op", "production order"],
  line: ["linea", "linea de produccion", "line"],
  productCode: ["producto", "codigo producto", "codigo interno", "sku"],
  product: ["descripcion", "producto descripcion", "nombre producto", "description"],
  originalQuantity: ["c ori", "cantidad original", "cant original", "cantidad de origen"],
  availableQuantity: ["cant", "cantidad", "cantidad de botellas", "botellas"],
  fractionationDate: ["fecha fraccionam", "fecha fraccionamiento", "fecha de fraccionamiento", "fecha llenado"],
  location: ["deposito", "ubicacion", "location", "almacen"],
  sourceStatus: ["estado", "status", "situacion"],
  lot: ["lote", "lot"],
  cut: ["corte ap", "corte", "numero de corte", "n de corte"],
  client: ["cliente", "customer"],
  country: ["pais", "pais destino", "destino", "country"],
  variety: ["variedad", "varietal", "variety"],
  harvest: ["cosecha", "anada", "vintage"],
};

export type StackImportResult = {
  stacks: StackRecord[];
  sheetName: string;
  columnsDetected: string[];
  extraColumns: string[];
  rejectedRows: number;
  sourceRows: number;
};

export type LotImportResult = {
  lots: LotDate[];
  years: number[];
  sheetNames: string[];
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function canonicalField(header: unknown): CanonicalField | null {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<[CanonicalField, string[]]>) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) return field;
  }
  return null;
}

function parseNumeric(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim().replace(/\s/g, "");
  if (!text) return 0;
  const normalized = text.includes(",") && !text.includes(".")
    ? text.replace(/\./g, "").replace(",", ".")
    : text.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferVariety(description: string): string {
  const text = normalizeHeader(description);
  const matches: Array<[RegExp, string]> = [
    [/\bmalbec\b|\bmb\b/, "Malbec"], [/chardonnay|\bch\b/, "Chardonnay"],
    [/cabernet sauvignon|cab sau|\bcs\b/, "Cabernet Sauvignon"], [/torrontes|torr/, "Torrontés"],
    [/pinot noir|p noir/, "Pinot Noir"], [/syrah/, "Syrah"], [/bonarda|\bbn\b/, "Bonarda"],
    [/viognier/, "Viognier"], [/semillon/, "Semillón"],
  ];
  return matches.find(([pattern]) => pattern.test(text))?.[1] ?? "";
}

function inferHarvest(description: string, productCode: string): string {
  const match = `${description} ${productCode}`.match(/(?:^|\D)(20\d{2}|\d{2})(?:\D|$)/);
  if (!match) return "";
  return match[1].length === 2 ? `20${match[1]}` : match[1];
}

export async function parseEstibasFile(file: File): Promise<StackImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  let best: { sheetName: string; matrix: unknown[][]; headerIndex: number; score: number } | null = null;

  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1, defval: null, raw: false, dateNF: "dd/mm/yyyy",
    });
    for (let row = 0; row < Math.min(matrix.length, 40); row += 1) {
      const fields = new Set(matrix[row].map(canonicalField).filter(Boolean));
      const score = fields.size + (fields.has("barcode") ? 2 : 0) + (fields.has("productCode") ? 3 : 0) + (fields.has("availableQuantity") ? 3 : 0);
      if (!best || score > best.score) best = { sheetName, matrix, headerIndex: row, score };
    }
  }

  if (!best || best.score < 6) throw new Error("No se encontró una tabla de estibas con Producto y Cantidad.");
  const headers = best.matrix[best.headerIndex].map((value) => String(value ?? "").trim());
  const mapping = new Map<number, CanonicalField>();
  headers.forEach((header, index) => { const field = canonicalField(header); if (field && ![...mapping.values()].includes(field)) mapping.set(index, field); });
  const extraColumns = headers.filter((header, index) => header && !mapping.has(index));
  let rejectedRows = 0;
  const stacks: StackRecord[] = [];

  best.matrix.slice(best.headerIndex + 1).forEach((row, rowOffset) => {
    const values: Partial<Record<CanonicalField, unknown>> = {};
    const extraData: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      const field = mapping.get(index);
      if (field) values[field] = row[index];
      else if (header && row[index] !== null && row[index] !== "") extraData[header] = row[index];
    });
    const rawBarcode = String(values.barcode ?? "").trim();
    if (/total de pallets/i.test(rawBarcode)) return;
    const productCode = String(values.productCode ?? "").trim();
    const product = String(values.product ?? productCode).trim();
    const stableParts=[productCode,product,String(values.lot??""),String(values.cut??""),String(values.pallet??""),String(best.headerIndex+rowOffset+2)];
    const barcode=rawBarcode||`SIN-CB-${stableParts.map(value=>normalizeHeader(value)).join("-")}`;
    const available = parseNumeric(values.availableQuantity);
    if (!productCode && !product && !String(values.lot??"").trim()) { rejectedRows += 1; return; }
    const rawClient = String(values.client ?? "").trim();
    stacks.push({
      id: `${barcode}-${String(values.pallet ?? rowOffset + 1).trim()}-${best.headerIndex+rowOffset+2}`,
      barcode,
      pallet: String(values.pallet ?? "").trim(),
      productionOrder: String(values.productionOrder ?? "").trim(),
      line: String(values.line ?? "").trim(),
      productCode,
      product,
      originalQuantity: parseNumeric(values.originalQuantity) || available,
      availableQuantity: available || parseNumeric(values.originalQuantity),
      fractionationDate: toIsoDate(values.fractionationDate),
      location: String(values.location ?? "").trim(),
      sourceStatus: String(values.sourceStatus ?? "").trim(),
      lot: String(values.lot ?? "").trim(),
      cut: String(values.cut ?? "").trim(),
      client: rawClient && rawClient !== "84" ? rawClient : "No informado",
      country: String(values.country ?? "").trim(),
      variety: String(values.variety ?? "").trim() || inferVariety(product),
      harvest: String(values.harvest ?? "").trim() || inferHarvest(product, productCode),
      used: false,
      extraData: { ...extraData, sourceFile: file.name, sourceRow: best.headerIndex + rowOffset + 2 },
    });
  });

  if (!stacks.length) throw new Error("El archivo no contiene filas válidas para importar.");
  return { stacks, sheetName: best.sheetName, columnsDetected: headers.filter(Boolean), extraColumns, rejectedRows, sourceRows: best.matrix.length - best.headerIndex - 1 };
}

export async function parseLotsFile(file: File): Promise<LotImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const lots = new Map<string, LotDate>();
  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
    matrix.flat().forEach((value) => {
      const code = String(value ?? "").trim();
      const lot = lotDateFromCode(code);
      if (lot) lots.set(code, { ...lot, sourceName: file.name });
    });
  }
  if (!lots.size) throw new Error("No se encontraron códigos de lote con formato anual (por ejemplo 26001).");
  const result = [...lots.values()].sort((a, b) => a.code.localeCompare(b.code));
  return { lots: result, years: [...new Set(result.map((lot) => lot.year))], sheetNames: workbook.SheetNames };
}

export async function exampleFile(path: string, name: string): Promise<File> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`No se pudo abrir ${name}.`);
  return new File([await response.blob()], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
