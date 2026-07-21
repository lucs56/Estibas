import type { EvaluatedStack, ExpiryStatus, LotDate, StackRecord } from "./types";

const DAY = 86_400_000;
export const normalizeLotCode = (value: string) => value.match(/\b(\d{5})\b/)?.[1] ?? null;

export function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) return new Date(Date.UTC(1899, 11, 30) + value * DAY).toISOString().slice(0, 10);
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!local) return null;
  const year = Number(local[3]) < 100 ? 2000 + Number(local[3]) : Number(local[3]);
  return `${year}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function lotDateFromCode(code: string): LotDate | null {
  if (!/^\d{5}$/.test(code)) return null;
  const year = 2000 + Number(code.slice(0, 2)); const day = Number(code.slice(2));
  const max = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  if (day < 1 || day > max) return null;
  return { code, year, elaborationDate: new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10), sourceName: `Lotes ${year}.xlsx` };
}

export function evaluateStack(stack: StackRecord, lots: Map<string, LotDate>, today = new Date(), expirationDays = 90, urgentDays = 15, warningDays = 30): EvaluatedStack {
  let elaborationDate: string | null = null;
  let rule: EvaluatedStack["rule"] = "unsupported";
  let expiryStatus: ExpiryStatus = "unsupported";
  const code=normalizeLotCode(stack.lot);
  elaborationDate=code ? lots.get(code)?.elaborationDate ?? lotDateFromCode(code)?.elaborationDate ?? null : null;
  if (stack.barcode.startsWith("01")) rule = "barcode01";
  else if (stack.barcode.startsWith("218")) rule = "barcode218";
  expiryStatus=elaborationDate?"ok":"missingLot";
  if (!elaborationDate) return { ...stack, elaborationDate: null, expiryDate: null, daysRemaining: null, expiryStatus, rule };
  const expiryDate = addDays(elaborationDate, expirationDays);
  const daysRemaining = Math.round((new Date(`${expiryDate}T12:00:00Z`).getTime() - new Date(`${today.toISOString().slice(0, 10)}T12:00:00Z`).getTime()) / DAY);
  expiryStatus = daysRemaining < 0 ? "expired" : daysRemaining < urgentDays ? "under15" : daysRemaining < warningDays ? "under30" : "ok";
  return { ...stack, fractionationDate: elaborationDate, elaborationDate, expiryDate, daysRemaining, expiryStatus, rule };
}

export const formatDate = (value: string | null) => {if(!value)return "—";const date=new Date(`${value}T12:00:00Z`);return Number.isNaN(date.valueOf())?value:new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);};
export const statusLabel = (status: ExpiryStatus) => ({ expired: "Vencida", under15: "Menos de 15 días", under30: "Menos de 30 días", ok: "Correcta", missingLot: "Lote sin fecha", unsupported: "Sin regla" }[status]);

export function weekStartIso(value:string,year=new Date().getFullYear()){
  const match=value.match(/(?:SEM(?:ANA)?\s*)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i);
  if(!match)return value;
  const resolvedYear=match[3]?(Number(match[3])<100?2000+Number(match[3]):Number(match[3])):year;
  return `${resolvedYear}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;
}
