export type ExpiryStatus = "expired" | "under15" | "under30" | "ok" | "missingLot" | "unsupported";

export type StackRecord = {
  id: string; barcode: string; pallet: string; productionOrder?: string; line: string;
  productCode: string; product: string; originalQuantity: number; availableQuantity: number;
  fractionationDate: string | null; location: string; sourceStatus?: string; lot: string; cut: string;
  client: string; country: string; variety: string; harvest: string; used: boolean;
  extraData: Record<string, unknown>;
};

export type LotDate = { code: string; elaborationDate: string; year: number; sourceName: string };
export type EvaluatedStack = StackRecord & {
  elaborationDate: string | null; expiryDate: string | null; daysRemaining: number | null;
  expiryStatus: ExpiryStatus; rule: "barcode01" | "barcode218" | "unsupported";
};

export type ProductionOrder = {
  id: string; week: string; day: string; pn: string; internalCode: string; brand: string;
  variety: string; harvest: string; capacity: string; closure: string; liters: number;
  client: string; country: string; action: string; boxes: number; unitsPerBox: number;
  bottles: number; market: string; alcohol: string; cut: string; line: string;
  lineNumber: 1 | 2 | 3; sheetRow: number; observations: string; frc: string;
  possibleDressingDate: string; presentation: string; status: string; source: "simulated" | "google";
  veCompleted?: boolean; highlightedNew?: boolean;
};

export type VeRequest = {
  id: string; number: string; createdAt: string; requestDate: string; fillingDate: string;
  possibleDressingDate: string; line: string; brand: string; variety: string; harvest: string;
  cut: string; lots: string[]; selectedStackIds: string[]; totalStockBottles: number;
  requestedBottles: number; productCode: string; presentation: string; market: string;
  requestedBoxes: number; unitsPerBox: number; client: string; pn: string; destination: string; closure?: string;
  observed: boolean;
  allocations?: VeAllocation[];
  alcohol: string; responsible: string;
  status: "draft" | "generated" | "printed";
  samplesPrepared?: boolean;
};

export type VeAllocation = {
  stackId: string; lot: string; cut: string; pallet: string; barcode: string;
  productCode: string; product: string; availableBottles: number; groupAvailableBottles: number; usedBottles: number; fillingDate: string;
};

export type StockConsumption = { requestNumber: string; pn: string; bottles: number };

export type AuditEntry = { id: string; timestamp: string; actor: string; action: string; entity: string; detail: string };
export type UserRole = "Administrador" | "Supervisor" | "Operario";
export type AppUser = { id: string; name: string; email: string; username: string; credentialHash: string; role: UserRole; active: boolean };
export type AppCatalogs = Record<string, string[]>;
export type AppSettings = {
  expirationDays: number; urgentDays: number; warningDays: number; spreadsheetId: string;
  spreadsheetGid: string; googleMode: "simulation" | "connected";
};

export type PersistedAppState = {
  version: 5;
  stacks: StackRecord[];
  lots: LotDate[];
  orders: ProductionOrder[];
  requests: VeRequest[];
  users: AppUser[];
  catalogs: AppCatalogs;
  audit: AuditEntry[];
  settings: AppSettings;
};
