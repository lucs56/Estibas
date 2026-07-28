"use client";

import { Download, FileDown, History, Search, TestTube2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { exportVeExcel, exportVePdf, exportWeeklyVeExcel } from "@/lib/exporters";
import { buildSampleReportRows } from "@/lib/sample-report";
import type { VeRequest } from "@/lib/types";

type Props={requests:VeRequest[];onRequests:(value:VeRequest[])=>void;onDelete:(request:VeRequest)=>void};

export default function HistoryScreen({requests,onRequests,onDelete}:Props) {
  const [query,setQuery]=useState("");const [date,setDate]=useState("");
  const rows=useMemo(()=>requests.filter(r=>(!query||[r.number,r.client,r.pn,r.lots.join(" ")].join(" ").toLowerCase().includes(query.toLowerCase()))&&(!date||r.requestDate===date)),[requests,query,date]);
  const selected=requests.filter(request=>request.samplesPrepared);
  const toggle=(id:string)=>onRequests(requests.map(request=>request.id===id?{...request,samplesPrepared:!request.samplesPrepared}:request));
  const allVisibleSelected=rows.length>0&&rows.every(request=>request.samplesPrepared);
  const toggleAll=()=>{const ids=new Set(rows.map(request=>request.id));onRequests(requests.map(request=>ids.has(request.id)?{...request,samplesPrepared:!allVisibleSelected}:request));};
  const remove=(request:VeRequest)=>{if(window.confirm(`¿Eliminar ${request.number} y devolver al stock las botellas utilizadas?`))onDelete(request);};
  const exportSamples=()=>{const detail=buildSampleReportRows(selected);const sheet=XLSX.utils.json_to_sheet(detail);sheet["!cols"]=[{wch:18},{wch:42},{wch:18},{wch:18},{wch:24},{wch:30}];const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,"Muestras");XLSX.writeFile(book,`muestras-solicitudes-${new Date().toISOString().slice(0,10)}.xlsx`);};
  return <>
    <section className="page-heading"><div><div className="eyebrow"><i/> Trazabilidad documental</div><h1>Historial de Solicitudes VE</h1><p>Seleccione las solicitudes del día o de la semana y genere ambos reportes.</p></div><div className="heading-actions"><button className="secondary" disabled={!selected.length} onClick={exportSamples}><TestTube2 size={17}/> Reporte de muestras ({selected.length})</button><button className="primary" disabled={!selected.length} onClick={()=>void exportWeeklyVeExcel(selected)}><Download size={17}/> Generar Solicitud VE semanal ({selected.length})</button></div></section>
    <section className="history-summary"><div><History size={20}/><span><strong>{requests.length}</strong><small>Solicitudes generadas</small></span></div><div><TestTube2 size={20}/><span><strong>{selected.length}</strong><small>Seleccionadas para muestras</small></span></div></section>
    <section className="panel"><div className="history-tools"><label className="order-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Número, cliente, PIN° o lote…"/></label><label className="date-filter"><span>Fecha</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="secondary" onClick={toggleAll}>{allVisibleSelected?"Destildar visibles":"Seleccionar visibles"}</button></div>
      <div className="table-scroll"><table className="orders-table"><thead><tr><th>Muestra</th><th>Solicitud</th><th>Fecha</th><th>Cliente / Destino</th><th>Producto / Descripción</th><th>Lote / Corte</th><th>Cajas / Botellas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className={r.samplesPrepared?"sample-selected":""}><td><input type="checkbox" checked={Boolean(r.samplesPrepared)} onChange={()=>toggle(r.id)}/></td><td><strong className="mono">{r.number}</strong><small>{r.pn}</small></td><td>{r.requestDate.split("-").reverse().join("/")}</td><td><strong>{r.client}</strong><small>{r.destination}</small></td><td><strong>{r.productCode}</strong><small>{r.allocations?.[0]?.product||r.brand}</small></td><td><strong>{r.lots.join(" / ")}</strong><small>Corte {r.cut}</small></td><td><strong>{(r.requestedBoxes??Math.ceil(r.requestedBottles/Math.max(1,r.unitsPerBox??1))).toLocaleString("es-AR")} cajas</strong><small>{r.requestedBottles.toLocaleString("es-AR")} botellas</small></td><td><span className="order-status">Generada</span></td><td><div className="export-mini"><button title="Excel" onClick={()=>void exportVeExcel(r)}><Download size={14}/> XLSX</button><button title="PDF" onClick={()=>void exportVePdf(r)}><FileDown size={14}/> PDF</button><button className="delete-request" title="Eliminar y recuperar stock" onClick={()=>remove(r)}><Trash2 size={14}/> Eliminar</button></div></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
