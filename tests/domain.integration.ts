import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateStack, weekStartIso } from "../lib/expiry";
import { parseEstibasFile, parseLotsFile } from "../lib/importers";
import { parseDressingProgram } from "../lib/sheet-program";
import { allocateFefo, groupAllocationsByLot, stockGroupKey } from "../lib/allocations";
import { caseQuantity, varietyWithClosure } from "../lib/exporters";
import type { LotDate, StackRecord } from "../lib/types";

const at = new Date("2026-07-18T12:00:00Z");

function workbook(path: string) {
  return new File([readFileSync(path)], path.split("/").at(-1), {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function stack(overrides: Partial<StackRecord>): StackRecord {
  return {
    id:"s",barcode:"018000000000",pallet:"1",line:"J01",productCode:"P",product:"Vino",
    originalQuantity:100,availableQuantity:100,fractionationDate:"2026-04-20",location:"E18",
    lot:"",cut:"",client:"Cliente",country:"Argentina",variety:"Malbec",harvest:"2025",used:false,
    extraData:{},...overrides,
  };
}

test("aplica las reglas de 90 días y los límites de alerta", () => {
  const lots = new Map<string, LotDate>([["26119", {code:"26119",year:2026,elaborationDate:"2026-04-29",sourceName:"Lotes 2026.xlsx"}]]);
  const fromFractionation = evaluateStack(stack({}), lots, at);
  assert.equal(fromFractionation.elaborationDate, "2026-04-20");
  assert.equal(fromFractionation.expiryDate, "2026-07-19");
  assert.equal(fromFractionation.expiryStatus, "under15");

  const fromLot = evaluateStack(stack({barcode:"218000000000",lot:"L1 - 26119",fractionationDate:"2020-01-01"}), lots, at);
  assert.equal(fromLot.elaborationDate, "2026-04-29");
  assert.equal(fromLot.expiryDate, "2026-07-28");
  assert.equal(fromLot.daysRemaining, 10);
  assert.equal(fromLot.expiryStatus, "under15");

  assert.equal(evaluateStack(stack({fractionationDate:"2026-05-04"}),lots,at).expiryStatus,"under30");
  assert.equal(evaluateStack(stack({fractionationDate:"2026-05-19"}),lots,at).expiryStatus,"ok");
  assert.equal(evaluateStack(stack({barcode:"027000000000"}),lots,at).expiryStatus,"unsupported");
});

test("extrae sólo VESTIR y conserva la línea del bloque visual", () => {
  const header=["PIN°","Código","Marca","Variedad","Cosecha","Capacidad","Tapón/SC","Litros","Cliente","País Destino","Acción","Cajas","Cj x","Botellas","Observaciones","FRC"];
  const row=(pin:string,action:string,bottles:number)=>[pin,"301-25-501","ALAMOS","CHARDONNAY",2025,"0,75","SCREW CAP",693,"EXPORTACIÓN","USA",action,77,12,bottles,"Obs","F1"];
  const orders=parseDressingProgram([{name:" Sem 20-07 al 24-07",rows:[
    ["PROGRAMACION LINEA 1"],header,row("P1","FRACCIONAR",924),row("P2","VESTIR",924),
    ["PROGRAMACION LINEA 2"],header,row("P3","VESTIR",840),
    ["PROGRAMACION LINEA 3"],header,row("P4","VESTIR",0),row("P5","VESTIR",1200),
  ]}],"simulated");
  assert.deepEqual(orders.map(order=>[order.pn,order.lineNumber,order.action,order.bottles]),[["P2",1,"VESTIR",924],["P3",2,"VESTIR",840],["P5",3,"VESTIR",1200]]);
  assert.equal(orders[0].presentation,"12 × 750 mL");
});

test("consume sucesivamente lotes FEFO hasta completar exactamente el pedido", () => {
  const first=evaluateStack(stack({id:"old",lot:"25152",availableQuantity:200,fractionationDate:"2026-04-20"}),new Map(),at);
  const second=evaluateStack(stack({id:"next",lot:"25153",availableQuantity:400,fractionationDate:"2026-04-21"}),new Map(),at);
  const third=evaluateStack(stack({id:"later",lot:"25154",availableQuantity:300,fractionationDate:"2026-04-22"}),new Map(),at);
  const allocations=allocateFefo([first,second,third],500);
  assert.deepEqual(allocations.map(item=>[item.lot,item.usedBottles]),[["25152",200],["25153",300]]);
  assert.equal(groupAllocationsByLot(allocations).length,2);
});

test("consolida stock por producto, lote y fecha pero ocupa sólo lo necesario", () => {
  const first=evaluateStack(stack({id:"a",productCode:"301",lot:"26112",availableQuantity:600,fractionationDate:"2026-04-22"}),new Map(),at);
  const second=evaluateStack(stack({id:"b",productCode:"301",lot:"26115",availableQuantity:1200,fractionationDate:"2026-04-25"}),new Map(),at);
  const groups=groupAllocationsByLot(allocateFefo([first,second],1200));
  assert.deepEqual(groups.map(group=>[group.lot,group.availableBottles,group.usedBottles,group.productCode]),[["26112",600,600,"301"],["26115",1200,600,"301"]]);
});

test("unifica variantes de espacios y agota el grupo antes de seguir", () => {
  assert.equal(stockGroupKey("302E ","L1 - 26188","2026-07-07"),stockGroupKey("302e","L1- 26188 ","2026-07-07"));
  const old=evaluateStack(stack({id:"old",productCode:"302E",lot:"L1 - 26161",availableQuantity:140,fractionationDate:"2026-06-10"}),new Map(),at);
  const targetA=evaluateStack(stack({id:"a",productCode:"302E",lot:"L1 - 26188",availableQuantity:672,fractionationDate:"2026-07-07"}),new Map(),at);
  const next=evaluateStack(stack({id:"next",productCode:"302E",lot:"L1 - 26190",availableQuantity:1000,fractionationDate:"2026-07-09"}),new Map(),at);
  const targetB=evaluateStack(stack({id:"b",productCode:"302e",lot:"L1- 26188",availableQuantity:1085,fractionationDate:"2026-07-07"}),new Map(),at);
  const groups=groupAllocationsByLot(allocateFefo([old,targetA,next,targetB],2520));
  assert.deepEqual(groups.map(group=>[group.lot,group.availableBottles,group.usedBottles]),[["L1 - 26161",140,140],["L1 - 26188",1757,1757],["L1 - 26190",1000,623]]);
});

test("calcula cajas desde las botellas ocupadas y la presentación", () => {
  assert.equal(caseQuantity(632,12),53);
  assert.equal(caseQuantity(630,6),105);
});

test("agrega SCREW a la variedad sólo cuando lo indica Tapón/SC", () => {
  assert.equal(varietyWithClosure({variety:"CHARDONNAY",closure:"Screw"}),"CHARDONNAY SCREW");
  assert.equal(varietyWithClosure({variety:"MALBEC",closure:"Tapón"}),"MALBEC");
});

test("deduce año y día juliano del lote y normaliza el inicio de semana", () => {
  const old=evaluateStack(stack({barcode:"218000000000",lot:"L1 - 25152",fractionationDate:"2026-07-01"}),new Map(),at);
  assert.equal(old.elaborationDate,"2025-06-01");
  const current=evaluateStack(stack({barcode:"218000000000",lot:"26082"}),new Map(),at);
  assert.equal(current.elaborationDate,"2026-03-23");
  assert.equal(weekStartIso("Sem 20-07 al 24-07",2026),"2026-07-20");
});

test("importa automáticamente los tres formatos reales de referencia", async () => {
  const lots = await parseLotsFile(workbook("public/examples/Lotes-2026-ejemplo.xlsx"));
  const report = await parseEstibasFile(workbook("public/examples/ESTIBAS-ejemplo.xlsx"));
  assert.equal(lots.lots.length,365);
  assert.deepEqual(lots.years,[2026]);
  assert.equal(report.stacks.length,601);
  assert.equal(report.columnsDetected.length,30);

  const lotMap = new Map(lots.lots.map(item=>[item.code,item]));
  const counts = report.stacks.reduce<Record<string,number>>((result,item)=>{
    const status=evaluateStack(item,lotMap,at).expiryStatus;
    result[status]=(result[status]??0)+1;
    return result;
  },{});
  assert.deepEqual(counts,{expired:352,under15:10,under30:26,ok:193,unsupported:20});
});
