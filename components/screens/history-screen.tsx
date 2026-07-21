"use client";

import { Download, FileDown, History, Search, TestTube2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { exportVeExcel, exportVePdf } from "@/lib/exporters";
import type { VeRequest } from "@/lib/types";

type Props={requests:VeRequest[];onRequests:(value:VeRequest[])=>void;onDelete:(request:VeRequest)=>void};

export default function HistoryScreen({requests,onRequests,onDelete}:Props) {
  const [query,setQuery]=useState("");const [date,setDate]=useState("");
  const rows=useMemo(()=>requests.filter(r=>(!query||[r.number,r.client,r.pn,r.lots.join(" ")].join(" ").toLowerCase().includes(query.toLowerCase()))&&(!date||r.requestDate===date)),[requests,query,date]);
  const selected=requests.filter(request=>request.samplesPrepared);
  const toggle=(id:string)=>onRequests(requests.map(request=>request.id===id?{...request,samplesPrepared:!request.samplesPrepared}:request));
  const remove=(request:VeRequest)=>{if(window.confirm(`¿Eliminar ${request.number} y devolver al stock las botellas utilizadas?`))onDelete(request);};
  const exportSamples=()=>{const detail=selected.flatMap(request=>{const groups=request.allocations?.length?request.allocations:[{productCode:request.productCode,product:request.brand,lot:request.lots.join(" / "),cut:request.cut}];return groups.map(item=>({Producto:item.productCode,"Descripción":item.product,Lote:item.lot,Corte:item.cut,"PIN°":request.pn,Solicitud:request.number}));});const sheet=XLSX.utils.json_to_sheet(detail);sheet["!cols"]=[{wch:18},{wch:42},{wch:18},{wch:18},{wch:20},{wch:20}];const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,"Muestras");XLSX.writeFile(book,`muestras-solicitudes-${new Date().toISOString().slice(0,10)}.xlsx`);};
  return <>
    <section className="page-heading"><div><div className="eyebrow"><i/> Trazabilidad documental</div><h1>Historial de Solicitudes VE</h1><p>Puede eliminar solicitudes de prueba; las botellas utilizadas se devolverán automáticamente al stock.</p></div><button className="primary" disabled={!selected.length} onClick={exportSamples}><TestTube2 size={17}/> Reporte de muestras ({selected.length})</button></section>
    <section className="history-summary"><div><History size={20}/><span><strong>{requests.length}</strong><small>Solicitudes generadas</small></span></div><div><TestTube2 size={20}/><span><strong>{selected.length}</strong><small>Seleccionadas para muestras</small></span></div></section>
    <section className="panel"><div className="history-tools"><label className="order-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Número, cliente, PIN° o lote…"/></label><label className="date-filter"><span>Fecha</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
      <div className="table-scroll"><table className="orders-table"><thead><tr><th>Muestra</th><th>Solicitud</th><th>Fecha</th><th>Cliente / Destino</th><th>Producto / Descripción</th><th>Lote / Corte</th><th>Cajas / Botellas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className={r.samplesPrepared?"sample-selected":""}><td><input type="checkbox" checked={Boolean(r.samplesPrepared)} onChange={()=>toggle(r.id)}/></td><td><strong className="mono">{r.number}</strong><small>{r.pn}</small></td><td>{r.requestDate.split("-").reverse().join("/")}</td><td><strong>{r.client}</strong><small>{r.destination}</small></td><td><strong>{r.productCode}</strong><small>{r.allocations?.[0]?.product||r.brand}</small></td><td><strong>{r.lots.join(" / ")}</strong><small>Corte {r.cut}</small></td><td><strong>{(r.requestedBoxes??Math.ceil(r.requestedBottles/Math.max(1,r.unitsPerBox??1))).toLocaleString("es-AR")} cajas</strong><small>{r.requestedBottles.toLocaleString("es-AR")} botellas</small></td><td><span className="order-status">Generada</span></td><td><div className="export-mini"><button title="Excel" onClick={()=>void exportVeExcel(r)}><Download size={14}/> XLSX</button><button title="PDF" onClick={()=>void exportVePdf(r)}><FileDown size={14}/> PDF</button><button className="delete-request" title="Eliminar y recuperar stock" onClick={()=>remove(r)}><Trash2 size={14}/> Eliminar</button></div></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
