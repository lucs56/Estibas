"use client";

import type { VeRequest } from "./types";
import type { Worksheet } from "exceljs";
import { groupAllocationsByLot } from "./allocations";
import { formatDate } from "./expiry";

function safeFilename(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportVeExcel(request: VeRequest) {
  const ExcelJS = await import("exceljs");
  const response = await fetch("/examples/Solicitud-VE-template.xlsx");
  if (!response.ok) throw new Error("No se pudo cargar la plantilla de Solicitud VE.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  const template = workbook.worksheets[0];
  const units=request.unitsPerBox??Number(request.presentation.match(/^\d+/)?.[0]??0);
  const groups=groupAllocationsByLot(request.allocations??[]);
  const sheets=groups.length?groups:[{lot:request.lots.join(" / "),cut:request.cut,fillingDate:request.fillingDate,productCode:request.productCode,product:request.brand,availableBottles:request.totalStockBottles,usedBottles:request.requestedBottles,items:[]}];
  sheets.forEach((group,index)=>{
    const sheet=index===0?template:cloneWorksheet(template,workbook.addWorksheet(`temporal-${index}`));
    sheet.name=uniqueSheetName(workbook,`${request.brand} ${group.lot}`,sheet);
    fillVeSheet(sheet,request,{lot:group.lot,cut:group.cut||request.cut,fillingDate:group.fillingDate,productCode:group.productCode,stock:group.availableBottles,used:group.usedBottles,boxes:caseQuantity(group.usedBottles,units)},units);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeFilename(request.brand)}-${safeFilename(request.number)}.xlsx`);
}

function fillVeSheet(sheet:Worksheet,request:VeRequest,allocation:{lot:string;cut:string;fillingDate:string;productCode:string;stock:number;used:number;boxes:number},units:number){
  const set = (cell: string, value: string) => { sheet.getCell(cell).value = value; };
  set("B5", `FECHA DE SOLICITUD: ${request.requestDate.split("-").reverse().join("/")}`);
  set("B6", `FECHA DE LLENADO: ${formatDate(allocation.fillingDate)}`);
  set("B7", `FECHA POSIBLE DE VESTIDO: ${formatDate(request.possibleDressingDate)}`);
  set("B8", `LINEA DE PRODUCTO: ${request.brand}`);
  set("B9", `VARIEDAD: ${varietyWithClosure(request)}`);
  set("B10", `COSECHA: ${request.harvest}`);
  set("B11", `Nº DE CORTE: ${allocation.cut}`);
  set("B12", `LOTE: ${allocation.lot}`);
  set("B13", `CANTIDAD DE BOTELLAS EN ESTIBA: ${allocation.stock.toLocaleString("es-AR")}     SE OCUPAN: ${allocation.used.toLocaleString("es-AR")}     CÓDIGO: ${allocation.productCode}`);
  sheet.getCell("E14").value=null;
  sheet.getCell("E15").value=null;sheet.getCell("M15").value=null;sheet.getCell("O15").value=null;
  const caseCell=request.market.toLowerCase().includes("interno")?sheet.getCell("E15"):units===12?sheet.getCell("O15"):sheet.getCell("M15");
  caseCell.value=allocation.boxes;caseCell.numFmt="0";
  set("B16", `CLIENTE: ${request.client}     PN#: ${request.pn}     PAÍS DESTINO: ${request.destination}`);
  set("B17", `Alcohol etiqueta: ${request.alcohol}`);
}

export function caseQuantity(usedBottles:number,unitsPerBox:number){return Math.ceil(usedBottles/Math.max(1,unitsPerBox));}
export function varietyWithClosure(request:Pick<VeRequest,"variety"|"closure">){return request.closure?.trim().toLowerCase().includes("screw")?`${request.variety} SCREW`:request.variety;}

function cloneWorksheet(source:Worksheet,target:Worksheet){
  source.columns.forEach((column,index)=>{target.getColumn(index+1).width=column.width;target.getColumn(index+1).hidden=column.hidden;});
  source.eachRow({includeEmpty:true},(row,rowNumber)=>{const copy=target.getRow(rowNumber);copy.height=row.height;row.eachCell({includeEmpty:true},(cell,columnNumber)=>{const next=copy.getCell(columnNumber);next.value=cell.value;next.style=structuredClone(cell.style);next.numFmt=cell.numFmt;});});
  for(const merge of source.model.merges)target.mergeCells(merge);
  target.pageSetup=structuredClone(source.pageSetup);target.properties=structuredClone(source.properties);target.headerFooter=structuredClone(source.headerFooter);target.views=structuredClone(source.views);
  return target;
}

function uniqueSheetName(workbook:{worksheets:Worksheet[]},raw:string,current:Worksheet){
  const base=(safeFilename(raw).replace(/-/g," ")||"Producto").slice(0,31);let name=base;let index=2;
  while(workbook.worksheets.some(sheet=>sheet!==current&&sheet.name===name)){const suffix=` ${index++}`;name=`${base.slice(0,31-suffix.length)}${suffix}`;}
  return name;
}

export async function exportVePdf(request: VeRequest) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const left = 12; const right = 198; let y = 13;
  const line = (height: number) => { doc.rect(left, y, right - left, height); y += height; };
  doc.setFont("helvetica", "normal"); doc.setTextColor(200, 30, 40); doc.setFontSize(12); doc.text("BODEGAS ESMERALDA S.A.", left, y); y += 4;
  doc.setTextColor(20, 20, 20); doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.text("SOLICITUD DE VESTIDO DE VINOS EN ESTIBA", 105, y + 9, { align: "center" });
  doc.setFontSize(8); doc.text("R1 IB 03 · Rev. 07", 165, y + 8); line(18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.4);
  const boxes=request.requestedBoxes??Math.ceil(request.requestedBottles/Math.max(1,request.unitsPerBox??1));
  const fields = [
    ["FECHA DE SOLICITUD", request.requestDate.split("-").reverse().join("/")], ["FECHA DE LLENADO", request.fillingDate.split("-").reverse().join("/")],
    ["FECHA POSIBLE DE VESTIDO", formatDate(request.possibleDressingDate)], ["LÍNEA DE PRODUCTO", request.brand],
    ["VARIEDAD / COSECHA", `${varietyWithClosure(request)} · ${request.harvest}`], ["Nº DE CORTE / LOTE", `${request.cut} · ${request.lots.join(" / ")}`],
    ["BOTELLAS EN ESTIBA / SE OCUPAN", `${request.totalStockBottles.toLocaleString("es-AR")} / ${request.requestedBottles.toLocaleString("es-AR")}`],
    ["CÓDIGO / PRESENTACIÓN", `${request.productCode} · ${request.presentation}`], [request.market.toLowerCase().includes("interno")?"MERCADO INTERNO · CAJAS":`MERCADO EXTERNO · ${request.unitsPerBox} UNIDADES`, boxes.toLocaleString("es-AR")],
    ["CLIENTE", request.client], ["PN# / DESTINO", `${request.pn} · ${request.destination}`],
    ["ALCOHOL ETIQUETA", request.alcohol], ["RESPONSABLE", ""],
  ];
  fields.forEach(([label, value]) => { doc.setFont("helvetica", "bold"); doc.text(`${label}:`, left + 2, y + 5.5); doc.setFont("helvetica", "normal"); doc.text(String(value), left + 51, y + 5.5, { maxWidth: 130 }); line(8); });
  const section = (title: string, rows: number) => { doc.setFillColor(242, 243, 244); doc.rect(left, y, right - left, 8, "F"); doc.rect(left, y, right - left, 8); doc.setFont("helvetica", "bold"); doc.text(title, 105, y + 5.5, { align: "center" }); y += 8; doc.setFont("helvetica", "normal"); for (let i = 0; i < rows; i += 1) line(8); };
  section("LABORATORIO · ANÁLISIS", 5); section("LEGALES · ANÁLISIS QUÍMICO / ALÉRGENOS", 5); section("ENÓLOGO · DEGUSTACIÓN", 3);
  doc.setFontSize(7); doc.text(`${request.number} · Generada ${new Date(request.createdAt).toLocaleString("es-AR")}`, left, 292);
  doc.save(`${safeFilename(request.number)}.pdf`);
}
