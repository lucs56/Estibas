import * as XLSX from "xlsx";
import { parseDressingProgram, type SheetProgramTab } from "@/lib/sheet-program";

export const dynamic = "force-dynamic";

const SHEET_ID = /^[a-zA-Z0-9_-]{20,100}$/;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const spreadsheetId = url.searchParams.get("spreadsheetId")?.trim() ?? "";
    if (!SHEET_ID.test(spreadsheetId)) {
      return Response.json({ error: "El ID de Google Sheets no es válido." }, { status: 400 });
    }

    // The timestamp and no-store policy make every manual synchronization read
    // Google's current workbook instead of an edge/browser cached response.
    const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);
    exportUrl.searchParams.set("format", "xlsx");
    exportUrl.searchParams.set("_", Date.now().toString());
    const response = await fetch(exportUrl, {
      cache: "no-store",
      headers: { "cache-control": "no-cache, no-store", pragma: "no-cache" },
    });
    if (!response.ok) {
      throw new Error(response.status === 401 || response.status === 403
        ? "Google Sheets no permite leer la planilla. Compártala como lector mediante enlace."
        : `Google Sheets respondió ${response.status}.`);
    }

    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array", cellDates: true });
    const tabs: SheetProgramTab[] = workbook.SheetNames.map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "", raw: false }),
    }));
    const orders = parseDressingProgram(tabs, "google");

    return Response.json(
      { orders, synchronizedAt: new Date().toISOString(), tabs: workbook.SheetNames },
      { headers: { "cache-control": "no-store, no-cache, must-revalidate, max-age=0" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo sincronizar Google Sheets." },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
