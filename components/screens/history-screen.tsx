"use client";

import { Download, FileDown, History, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { exportVeExcel, exportVePdf } from "@/lib/exporters";
import type { VeRequest } from "@/lib/types";

export default function HistoryScreen({requests}:{requests:VeRequest[]}) {
  const [query,setQuery]=useState(""); const [date,setDate]=useState("");
  const rows=useMemo(()=>requests.filter(r=>(!query||[r.number,r.client,r.pn,r.lots.join(" ")].join(" ").toLowerCase().includes(query.toLowerCase()))&&(!date||r.requestDate===date)),[requests,query,date]);
  return <><section className="page-heading"><div><div className="eyebrow"><i/> Trazabilidad documental</div><h1>Historial de Solicitudes VE</h1><p>Todas las solicitudes generadas quedan disponibles para consulta y reimpresión.</p></div></section>
    <section className="history-summary"><div><History size={20}/><span><strong>{requests.length}</strong><small>Solicitudes generadas</small></span></div><div><FileDown size={20}/><span><strong>{requests.filter(r=>r.status==="generated").length}</strong><small>Documentos vigentes</small></span></div></section>
    <section className="panel"><div className="history-tools"><label className="order-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Número, cliente, PIN° o lote…"/></label><label className="date-filter"><span>Fecha</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div><div className="table-scroll"><table className="orders-table"><thead><tr><th>Solicitud</th><th>Fecha</th><th>Cliente / Destino</th><th>Producto</th><th>Lote / Corte</th><th>Cajas / Botellas</th><th>Estado</th><th>Exportar</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong className="mono">{r.number}</strong><small>{r.pn}</small></td><td>{r.requestDate.split("-").reverse().join("/")}</td><td><strong>{r.client}</strong><small>{r.destination}</small></td><td><strong>{r.brand}</strong><small>{r.variety} · {r.harvest}</small></td><td><strong>{r.lots.join(" / ")}</strong><small>Corte {r.cut}</small></td><td><strong>{(r.requestedBoxes??Math.ceil(r.requestedBottles/Math.max(1,r.unitsPerBox??1))).toLocaleString("es-AR")} cajas</strong><small>{r.requestedBottles.toLocaleString("es-AR")} botellas</small></td><td><span className="order-status">Generada</span></td><td><div className="export-mini"><button title="Excel" onClick={()=>void exportVeExcel(r)}><Download size={14}/> XLSX</button><button title="PDF" onClick={()=>void exportVePdf(r)}><FileDown size={14}/> PDF</button></div></td></tr>)}</tbody></table></div></section>
  </>;
}
