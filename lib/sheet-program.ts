import type { ProductionOrder } from "./types";
import { weekStartIso } from "./expiry";

export type SheetProgramTab = { name: string; rows: unknown[][] };

const text = (value: unknown) => String(value ?? "").trim();
const normalized = (value: unknown) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ");
const numeric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw=text(value).replace(/\s/g,"").replace(/\./g,"").replace(",",".");
  const result=Number(raw);return Number.isFinite(result)?result:0;
};

function presentation(capacity: string, units: number) {
  const liters=Number(capacity.replace(",","."));
  const milliliters=Number.isFinite(liters)&&liters>0?Math.round(liters*1000):capacity;
  return `${units} × ${milliliters} mL`;
}

/**
 * Reads the visual program structure instead of assuming fixed row ranges.
 * A row headed PROGRAMACION LINEA N changes the active production line; only
 * rows whose Acción is exactly VESTIR are returned.
 */
export function parseDressingProgram(tabs: SheetProgramTab[], source: ProductionOrder["source"]="google"): ProductionOrder[] {
  const result:ProductionOrder[]=[];
  for(const tab of tabs){
    let lineNumber:1|2|3|null=null;
    let headers=new Map<string,number>();
    tab.rows.forEach((row,rowIndex)=>{
      const section=normalized(row[0]).match(/PROGRAMACION LINEA ([123])/);
      if(section){lineNumber=Number(section[1]) as 1|2|3;headers=new Map();return;}
      if(row.some(cell=>normalized(cell)==="PIN°")&&row.some(cell=>normalized(cell)==="ACCION")){
        headers=new Map(row.map((cell,index)=>[normalized(cell),index]));return;
      }
      if(!lineNumber||!headers.size)return;
      const get=(name:string)=>row[headers.get(name)??-1];
      if(normalized(get("ACCION"))!=="VESTIR")return;
      const pn=text(get("PIN°"));const code=text(get("CODIGO"));const bottles=numeric(get("BOTELLAS"));
      if(!pn||!code||bottles<=0)return;
      const capacity=text(get("CAPACIDAD"));const units=numeric(get("CJ X"));const client=text(get("CLIENTE"));
      const week=tab.name.trim();
      result.push({
        id:`${week}-${lineNumber}-${rowIndex+1}-${pn}-${code}`,week,day:text(get("FECHA")),pn,internalCode:code,
        brand:text(get("MARCA")),variety:text(get("VARIEDAD")),harvest:text(get("COSECHA")),capacity,
        closure:text(get("TAPON/SC")),liters:numeric(get("LITROS")),client,country:text(get("PAIS DESTINO")),
        action:"VESTIR",boxes:numeric(get("CAJAS")),unitsPerBox:units,bottles,
        market:normalized(client).includes("MERCADO INTERNO")?"Mercado interno":"Mercado externo",
        alcohol:"",cut:"",line:`Línea ${lineNumber}`,lineNumber,sheetRow:rowIndex+1,
        observations:text(get("OBSERVACIONES")),frc:text(get("FRC")),possibleDressingDate:weekStartIso(week),
        presentation:presentation(capacity,units),status:"PROGRAMADO",source,
      });
    });
  }
  return result;
}
