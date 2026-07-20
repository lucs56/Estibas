"use client";

import { Cloud, FileSpreadsheet, RefreshCw, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProductionOrder } from "@/lib/types";

const lines=[1,2,3] as const;

export default function OrdersScreen({orders,onSync,onSelect,busy}:{orders:ProductionOrder[];onSync:()=>Promise<void>;onSelect:(order:ProductionOrder)=>void;busy:boolean}) {
  const syncRef=useRef(onSync);const busyRef=useRef(busy);
  useEffect(()=>{syncRef.current=onSync;busyRef.current=busy;},[onSync,busy]);
  useEffect(()=>{const timer=window.setInterval(()=>{if(document.visibilityState==="visible"&&!busyRef.current)void syncRef.current();},30_000);return()=>window.clearInterval(timer);},[]);
  const dressingOrders=useMemo(()=>orders.filter(order=>order.action.trim().toUpperCase()==="VESTIR"),[orders]);
  const weeks=[...new Set(dressingOrders.map(order=>order.week))];
  const [week,setWeek]=useState(weeks[0]??"");const [line,setLine]=useState<1|2|3>(3);const [query,setQuery]=useState("");
  const currentWeek=weeks.includes(week)?week:weeks[0]??"";
  const lineCounts=Object.fromEntries(lines.map(value=>[value,dressingOrders.filter(order=>order.week===currentWeek&&order.lineNumber===value).length])) as Record<1|2|3,number>;
  const visible=useMemo(()=>dressingOrders.filter(order=>order.week===currentWeek&&order.lineNumber===line&&(!query||[order.pn,order.internalCode,order.brand,order.variety,order.client,order.country].join(" ").toLowerCase().includes(query.toLowerCase()))),[dressingOrders,currentWeek,line,query]);

  return <>
    <section className="page-heading"><div><div className="eyebrow"><i/> Programa de vestido</div><h1>Pedidos para vestir</h1><p>Sólo se muestran filas cuya columna Acción dice VESTIR, respetando los bloques de líneas 1, 2 y 3.</p></div><button className="primary" onClick={()=>void onSync()} disabled={busy}><RefreshCw size={17} className={busy?"spin":""}/>{busy?"Actualizando…":"Actualizar programación"}</button></section>
    <section className="connection-card"><div className="connection-icon"><Cloud size={23}/></div><div><span className="connection-status"><i/> CONEXIÓN EN VIVO</span><strong>Programación Junín · Google Sheets</strong><p>Actualización automática cada 30 segundos y manual mediante el botón. Sólo incluye VESTIR de las líneas 1, 2 y 3.</p></div><div className="connection-meta"><span>Filas disponibles</span><strong>{dressingOrders.length} para vestir</strong><small>ID …xeBDPQ</small></div></section>
    <section className="panel order-panel">
      <div className="order-tools"><div className="week-tabs">{weeks.map(value=><button key={value} className={currentWeek===value?"active":""} onClick={()=>setWeek(value)}>{value}</button>)}</div><label className="order-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar PIN°, código, marca o cliente…"/></label></div>
      <div className="line-tabs">{lines.map(value=><button key={value} className={line===value?"active":""} onClick={()=>setLine(value)}><span>Línea {value}</span><b>{lineCounts[value]}</b></button>)}</div>
      <div className="program-caption"><span>Semana: <strong>{currentWeek}</strong></span><span>Acción: <strong>VESTIR</strong></span><span>Sección: <strong>Línea {line}</strong></span></div>
      <div className="table-scroll"><table className="orders-table program-table"><thead><tr><th>PIN°</th><th>Código</th><th>Marca / Variedad</th><th>Cosecha / Capacidad</th><th>Cliente / País destino</th><th>Cajas × Cj x</th><th>Botellas</th><th>Observaciones / FRC</th><th></th></tr></thead><tbody>{visible.map(order=><tr key={order.id}><td><strong className="mono">{order.pn}</strong><small>Fila {order.sheetRow}</small></td><td><strong className="mono">{order.internalCode}</strong><small>{order.closure}</small></td><td><strong>{order.brand}</strong><small>{order.variety}</small></td><td><strong>{order.harvest}</strong><small>{order.capacity}</small></td><td><strong>{order.client}</strong><small>{order.country}</small></td><td><strong>{order.boxes.toLocaleString("es-AR")} × {order.unitsPerBox}</strong><small>{order.presentation}</small></td><td><strong>{order.bottles.toLocaleString("es-AR")}</strong><small>VESTIR</small></td><td><strong>{order.observations||"—"}</strong><small>FRC {order.frc||"—"}</small></td><td><button className="quiet" onClick={()=>onSelect(order)}><Sparkles size={14}/> Elegir producto</button></td></tr>)}</tbody></table></div>
      {visible.length===0?<div className="empty-state"><FileSpreadsheet size={28}/><strong>No hay actividades VESTIR en la Línea {line}</strong><p>Si una fila de esa sección cambia de FRACCIONAR a VESTIR, aparecerá aquí al actualizar.</p></div>:null}
    </section>
  </>;
}
