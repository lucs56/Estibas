"use client";

import { AlertCircle, Check, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Filter, Search, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { formatDate, statusLabel } from "@/lib/expiry";
import { stockGroupKey } from "@/lib/allocations";
import type { EvaluatedStack, ExpiryStatus } from "@/lib/types";

type Props = {
  stacks: EvaluatedStack[];
  initialStatus: ExpiryStatus | "all";
  search: string;
  onSearch: (value: string) => void;
  selected: Set<string>;
  onSelected: (ids: Set<string>) => void;
  onImportStacks: (file: File) => Promise<void>;
  onImportLots: (file: File) => Promise<void>;
  onLoadExampleStacks: () => Promise<void>;
  onLoadExampleLots: () => Promise<void>;
  onGoVe: () => void;
  busy: string | null;
  importSummary: string | null;
};

const PAGE_SIZE = 18;
const statusOrder: ExpiryStatus[] = ["expired", "under15", "under30", "ok", "missingLot", "unsupported"];
const isUsable = (stack: EvaluatedStack) => stack.availableQuantity > 0 && ["under15", "under30", "ok"].includes(stack.expiryStatus);

export default function StacksScreen(props: Props) {
  const [status, setStatus] = useState<ExpiryStatus | "all">(props.initialStatus);
  const [client, setClient] = useState("all"); const [product, setProduct] = useState("all");
  const [line, setLine] = useState("all"); const [country, setCountry] = useState("all");
  const [variety, setVariety] = useState("all"); const [harvest, setHarvest] = useState("all");
  const [page, setPage] = useState(1);
  const stackInput = useRef<HTMLInputElement>(null); const lotInput = useRef<HTMLInputElement>(null);
  const options = (key: keyof EvaluatedStack) => [...new Set(props.stacks.map((s) => String(s[key] ?? "")).filter(Boolean))].sort();
  const filtered = useMemo(() => props.stacks.filter((s) => {
    const q = props.search.toLowerCase().trim();
    const matchesSearch = !q || [s.barcode,s.lot,s.productCode,s.product,s.client,s.cut].some((v) => v.toLowerCase().includes(q));
    return matchesSearch && (status === "all" || s.expiryStatus === status) && (client === "all" || s.client === client)
      && (product === "all" || s.product === product) && (line === "all" || s.line === line)
      && (country === "all" || s.country === country) && (variety === "all" || s.variety === variety)
      && (harvest === "all" || s.harvest === harvest);
  }), [props.stacks, props.search, status, client, product, line, country, variety, harvest]);
  const grouped=useMemo(()=>{const map=new Map<string,EvaluatedStack[]>();filtered.forEach(stack=>{const key=stockGroupKey(stack.productCode,stack.lot,stack.elaborationDate);map.set(key,[...(map.get(key)??[]),stack]);});return [...map.entries()].map(([key,members])=>({key,members,first:members[0],original:members.reduce((n,item)=>n+item.originalQuantity,0),available:members.reduce((n,item)=>n+item.availableQuantity,0),liters:members.reduce((n,item)=>n+numericExtra(item,"Litros"),0)}));},[filtered]);
  const pageCount = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE));
  const visible = grouped.slice((Math.min(page,pageCount)-1)*PAGE_SIZE, Math.min(page,pageCount)*PAGE_SIZE);
  const toggleGroup = (members:EvaluatedStack[]) => {const eligible=members.filter(isUsable);if(!eligible.length)return;const next=new Set(props.selected);const all=eligible.every(item=>next.has(item.id));eligible.forEach(item=>all?next.delete(item.id):next.add(item.id));props.onSelected(next);};
  const togglePage = () => { const next = new Set(props.selected); const eligible=visible.flatMap(group=>group.members.filter(isUsable));const all = eligible.length>0&&eligible.every((s) => next.has(s.id)); eligible.forEach((s) => {if(all)next.delete(s.id);else next.add(s.id);}); props.onSelected(next); };
  const reset = () => { props.onSearch("");setStatus("all");setClient("all");setProduct("all");setLine("all");setCountry("all");setVariety("all");setHarvest("all");setPage(1); };

  return <>
    <section className="page-heading"><div><div className="eyebrow"><i/> Inventario priorizado</div><h1>Gestión de estibas</h1><p>Importación automática por encabezados, control de vencimientos y selección para producción.</p></div><div className="heading-actions">
      <button className="secondary" onClick={() => lotInput.current?.click()} disabled={Boolean(props.busy)}><Upload size={17}/> Cargar lotes</button>
      <button className="primary" onClick={() => stackInput.current?.click()} disabled={Boolean(props.busy)}><FileSpreadsheet size={17}/> Cargar reporte</button>
      <input ref={stackInput} hidden type="file" accept=".xlsx,.xls" onChange={(e) => { const file=e.target.files?.[0]; if(file) void props.onImportStacks(file); e.currentTarget.value=""; }}/>
      <input ref={lotInput} hidden type="file" accept=".xlsx,.xls" onChange={(e) => { const file=e.target.files?.[0]; if(file) void props.onImportLots(file); e.currentTarget.value=""; }}/>
    </div></section>

    <section className="import-banner">
      <div className="import-icon"><FileSpreadsheet size={21}/></div>
      <div><strong>{props.importSummary ?? "Archivos reales listos para probar"}</strong><p>El sistema detecta la hoja, la fila de títulos y todas las columnas sin pedir mapeo manual.</p></div>
      <div className="example-actions"><button onClick={() => void props.onLoadExampleStacks()} disabled={Boolean(props.busy)}><Download size={15}/> Probar ESTIBAS.xlsx</button><button onClick={() => void props.onLoadExampleLots()} disabled={Boolean(props.busy)}><Download size={15}/> Probar Lotes 2026.xlsx</button></div>
    </section>

    <section className="panel filter-panel">
      <div className="filter-row"><label className="filter-search"><Search size={16}/><input aria-label="Buscar estibas" value={props.search} onChange={(e)=>{props.onSearch(e.target.value);setPage(1);}} placeholder="Código, lote, producto, cliente o corte…"/></label>
        <Select label="Estado" value={status} onChange={(v)=>{setStatus(v as ExpiryStatus|"all");setPage(1);}} items={statusOrder.map((s)=>[s,statusLabel(s)])}/>
        <Select label="Cliente" value={client} onChange={setClient} items={options("client").map(v=>[v,v])}/>
        <Select label="Producto" value={product} onChange={setProduct} items={options("product").map(v=>[v,v])}/>
        <button className="filter-more"><Filter size={15}/> Más filtros</button>
      </div>
      <div className="filter-row secondary-filters"><Select label="Línea" value={line} onChange={setLine} items={options("line").map(v=>[v,v])}/><Select label="País" value={country} onChange={setCountry} items={options("country").map(v=>[v,v])}/><Select label="Variedad" value={variety} onChange={setVariety} items={options("variety").map(v=>[v,v])}/><Select label="Cosecha" value={harvest} onChange={setHarvest} items={options("harvest").map(v=>[v,v])}/><button className="text-button reset-filter" onClick={reset}>Limpiar filtros</button></div>
    </section>

    <section className="panel stacks-panel">
      <div className="list-toolbar"><div><strong>{grouped.length.toLocaleString("es-AR")} grupos de stock</strong><span>consolidados por Producto + Descripción + Lote + Fecha</span></div><div>{props.selected.size>0?<><span className="selection-count"><Check size={14}/>Stock seleccionado</span><button className="primary compact" onClick={props.onGoVe}>Usar en Solicitud VE</button></>:null}</div></div>
      <div className="table-scroll"><table className="stack-table report-stock-table"><thead><tr><th><input aria-label="Seleccionar página" type="checkbox" checked={visible.length>0&&visible.flatMap(group=>group.members.filter(isUsable)).every(s=>props.selected.has(s.id))} onChange={togglePage}/></th>{["Producto","Descripción","Tipo de Fórmula","C.Ori","Cant","Fecha Fraccionam.","Hora","Usuario","Depósito","Estado","OP.Original","Parte Prod. Original","Parte Prod.","Aper","Análisis","Litros","Lote","INV","Ap. Exp.","Corte/AP","Vencimiento"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(group=>{const s=group.first;const eligible=group.members.filter(isUsable);const checked=eligible.length>0&&eligible.every(item=>props.selected.has(item.id));return <tr key={group.key} className={checked?"row-selected":""}><td><input aria-label={`Seleccionar ${s.productCode} ${s.lot}`} type="checkbox" disabled={!eligible.length} checked={checked} onChange={()=>toggleGroup(group.members)}/></td><td><strong className="mono">{s.productCode}</strong></td><td><strong>{s.product}</strong><small>{group.members.length} registros consolidados</small></td><td>{extra(s,"Tipo de Formula")}</td><td>{group.original.toLocaleString("es-AR")}</td><td><strong>{group.available.toLocaleString("es-AR")}</strong></td><td>{formatDate(s.fractionationDate)}</td><td>{extra(s,"Hora")}</td><td>{extra(s,"Usuario")}</td><td>{s.location||"—"}</td><td>{s.sourceStatus||"—"}</td><td>{extra(s,"OP.Original")}</td><td>{extra(s,"Parte Prod. Original")}</td><td>{extra(s,"Parte Prod.")}</td><td>{extra(s,"Aper")}</td><td>{extra(s,"Analisis")}</td><td>{group.liters.toLocaleString("es-AR")}</td><td><strong className="mono">{s.lot}</strong></td><td>{extra(s,"INV")}</td><td>{extra(s,"Ap. Exp.")}</td><td>{[...new Set(group.members.map(item=>item.cut).filter(Boolean))].join(" / ")||"—"}</td><td><span className={`status ${s.expiryStatus}`}><i/>{statusLabel(s.expiryStatus)}</span><small>{formatDate(s.expiryDate)}</small></td></tr>})}</tbody></table></div>
      <div className="pagination"><span>Página {Math.min(page,pageCount)} de {pageCount}</span><div><button aria-label="Página anterior" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}><ChevronLeft size={16}/></button><button aria-label="Página siguiente" onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={page>=pageCount}><ChevronRight size={16}/></button></div></div>
    </section>
    {props.stacks.some(s=>s.expiryStatus==="missingLot"||s.expiryStatus==="unsupported")?<div className="quality-alert"><AlertCircle size={17}/><span><strong>Control de calidad de datos:</strong> las estibas sin fecha de lote o con un prefijo sin regla no se consideran “correctas”. Deben completarse antes de liberarlas.</span></div>:null}
  </>;
}

function Select({label,value,onChange,items}:{label:string;value:string;onChange:(value:string)=>void;items:Array<[string,string]>}) { return <label className="filter-select"><span>{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)}><option value="all">Todos</option>{items.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>; }
function extra(stack:EvaluatedStack,key:string){const value=stack.extraData[key];return value===null||value===undefined||String(value).trim()===""?"—":String(value).trim();}
function numericExtra(stack:EvaluatedStack,key:string){const value=stack.extraData[key];if(typeof value==="number")return value;const parsed=Number(String(value??"").replace(",","."));return Number.isFinite(parsed)?parsed:0;}
