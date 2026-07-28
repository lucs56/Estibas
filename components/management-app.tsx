"use client";

import { AlertTriangle, BarChart3, Boxes, CalendarClock, CircleUserRound, ClipboardList, Database, FileSpreadsheet, History, LayoutDashboard, LogOut, PackageCheck, Search, Settings, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminScreen from "@/components/screens/admin-screen-secure";
import SecureLoginScreen from "@/components/secure-login-screen";
import HistoryScreen from "@/components/screens/history-screen";
import OrdersScreen from "@/components/screens/orders-screen";
import StacksScreen from "@/components/screens/stacks-screen";
import VeScreen from "@/components/screens/ve-screen";
import { evaluateStack, formatDate, statusLabel } from "@/lib/expiry";
import { reconcileHistoricalConsumption, restoreRequestConsumption } from "@/lib/allocations";
import { exampleFile, parseEstibasFile, parseLotsFile } from "@/lib/importers";
import { defaultCatalogs, defaultSettings, sampleAudit, sampleLots, sampleOrders, sampleRequests, sampleStacks, sampleUsers } from "@/lib/sample-data";
import type { AppCatalogs, AppSettings, AppUser, AuditEntry, EvaluatedStack, ExpiryStatus, LotDate, PersistedAppState, ProductionOrder, StackRecord, VeRequest } from "@/lib/types";

export type PageKey = "dashboard" | "stacks" | "orders" | "ve" | "history" | "admin";
const nav = [
  ["dashboard","Tablero",LayoutDashboard],["stacks","Estibas",Boxes],["orders","Pedidos",FileSpreadsheet],
  ["ve","Solicitud VE",ClipboardList],["history","Historial",History],["admin","Administración",Settings],
] as const;
const meta: Record<ExpiryStatus,{label:string;color:string}> = {
  expired:{label:"Vencidas",color:"#dc2626"},under15:{label:"Menos de 15 días",color:"#ea580c"},
  under30:{label:"Menos de 30 días",color:"#ca8a04"},ok:{label:"Correctas",color:"#16a34a"},
  missingLot:{label:"Lote sin fecha",color:"#64748b"},unsupported:{label:"Sin regla",color:"#7c3aed"},
};

type Viewer = { name: string; email: string };
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

export default function ManagementApp({ viewer }: { viewer: Viewer }) {
  const [page,setPage] = useState<PageKey>("dashboard");
  const [filter,setFilter] = useState<ExpiryStatus|"all">("all");
  const [stackSearch,setStackSearch] = useState("");
  const [stacks,setStacks] = useState<StackRecord[]>(sampleStacks);
  const [lots,setLots] = useState<LotDate[]>(sampleLots);
  const [orders,setOrders] = useState<ProductionOrder[]>(sampleOrders);
  const [requests,setRequests] = useState<VeRequest[]>(sampleRequests);
  const [users,setUsers] = useState<AppUser[]>(sampleUsers);
  const [catalogs,setCatalogs] = useState<AppCatalogs>(defaultCatalogs);
  const [audit,setAudit] = useState<AuditEntry[]>(sampleAudit);
  const [settings,setSettings] = useState<AppSettings>(defaultSettings);
  const [selected,setSelected] = useState<Set<string>>(new Set());
  const [activeOrder,setActiveOrder] = useState<ProductionOrder|null>(null);
  const [busy,setBusy] = useState<string|null>(null);
  const [importSummary,setImportSummary] = useState<string|null>(null);
  const [toast,setToast] = useState<{tone:"ok"|"error";message:string}|null>(null);
  const [persistence,setPersistence] = useState<"loading"|"ready"|"saving"|"saved"|"error">("loading");
  const [isHydrated,setIsHydrated] = useState(false);
  const [loggedUserId,setLoggedUserId] = useState<string|null>(()=>typeof window==="undefined"?null:window.sessionStorage.getItem("ve-user"));
  const [showPassword,setShowPassword]=useState(false);
  const [passwordDraft,setPasswordDraft]=useState({current:"",next:"",confirm:""});
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const evaluated = useMemo(() => {
    const lotMap = new Map(lots.map(l => [l.code,l]));
    return stacks.map(s => evaluateStack(s,lotMap,new Date(),settings.expirationDays,settings.urgentDays,settings.warningDays))
      .sort((a,b) => (a.daysRemaining ?? 99999) - (b.daysRemaining ?? 99999));
  },[stacks,lots,settings]);
  const counts = useMemo(() => {
    const byStatus = {expired:0,under15:0,under30:0,ok:0,missingLot:0,unsupported:0} as Record<ExpiryStatus,number>;
    evaluated.forEach(s => byStatus[s.expiryStatus]++);
    return { total:evaluated.length,byStatus,available:evaluated.filter(s=>!s.used).length,used:evaluated.filter(s=>s.used).length,bottles:evaluated.reduce((n,s)=>n+s.availableQuantity,0) };
  },[evaluated]);

  const loggedUser=users.find(user=>user.id===loggedUserId&&user.active)??null;
  const viewerName = loggedUser?.name ?? (viewer.name.includes("@") ? viewer.name.split("@")[0] : viewer.name);
  const currentRole = loggedUser?.role ?? "Operario";
  const notify=(message:string,tone:"ok"|"error"="ok")=>{setToast({message,tone});window.setTimeout(()=>setToast(null),4200);};
  const addAudit=(action:string,entity:string,detail:string)=>setAudit(current=>[{id:crypto.randomUUID(),timestamp:new Date().toISOString(),actor:viewerName,action,entity,detail},...current]);

  useEffect(() => {
    let active = true;
    fetch(apiUrl("/api/state"), { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("No se pudo recuperar el estado guardado.");
      return response.json() as Promise<{ state: (Partial<PersistedAppState> & { version?: number }) | null }>;
    }).then(({ state }) => {
      if (!active) return;
      if (state) {
        const savedLots=state.lots?.length?[...new Map([...sampleLots,...state.lots].map(lot=>[lot.code,lot])).values()]:sampleLots;
        const savedRequests=state.requests??sampleRequests;
        setLots(savedLots);setRequests(savedRequests);setStacks(reconcileHistoricalConsumption(state.stacks??sampleStacks,savedRequests,savedLots));
        setOrders(state.orders?.length ? state.orders : sampleOrders);
        setUsers(state.users?.length?state.users:sampleUsers);
        setCatalogs(state.catalogs??defaultCatalogs); setAudit(state.audit??sampleAudit); setSettings(state.settings??defaultSettings);
      }
      setIsHydrated(true);
      setPersistence(state ? "saved" : "ready");
    }).catch(() => {
      if (!active) return;
      setIsHydrated(true);
      setPersistence("error");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const timer = window.setTimeout(() => {
      const state: PersistedAppState = { version:5,stacks,lots,orders,requests,users,catalogs,audit,settings };
      setPersistence("saving");
      saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
        const response=await fetch(apiUrl("/api/state"), { method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(state) });
        if (!response.ok) throw new Error("No se pudo guardar el estado.");
        setPersistence("saved");
      }).catch(() => setPersistence("error"));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [stacks,lots,orders,requests,users,catalogs,audit,settings,isHydrated]);
  const importStacks=async(file:File)=>{setBusy("estibas");try{const result=await parseEstibasFile(file);const reconciled=reconcileHistoricalConsumption(result.stacks,requests,lots);setStacks(reconciled);setSelected(new Set());const deducted=reconciled.reduce((n,s)=>n+Number(s.extraData.totalConsumed??0),0);setImportSummary(`${result.stacks.length} filas importadas sin límite; se conservaron todas las columnas y se reconciliaron los consumos históricos.`);addAudit("Importación","Estibas",`${result.stacks.length} registros desde ${file.name}; consumos históricos aplicados`);notify(`Importación completa: ${result.stacks.length} estibas. Stock ya utilizado descontado automáticamente.`);}catch(error){notify(error instanceof Error?error.message:"No se pudo importar el reporte.","error");}finally{setBusy(null);}};
  const importLots=async(file:File)=>{setBusy("lotes");try{const result=await parseLotsFile(file);setLots(current=>[...new Map([...current,...result.lots].map(lot=>[lot.code,lot])).values()].sort((a,b)=>a.code.localeCompare(b.code)));setImportSummary(`${result.lots.length} lotes agregados (${result.years.join(", ")}) sin borrar el calendario 2016–2026.`);addAudit("Importación","Lotes",`${result.lots.length} lotes agregados desde ${file.name}`);notify(`Lotes agregados: ${result.lots.length}. Los años anteriores permanecen fijos.`);}catch(error){notify(error instanceof Error?error.message:"No se pudo importar el archivo de lotes.","error");}finally{setBusy(null);}};
  const loadStacks=async()=>{try{await importStacks(await exampleFile("/examples/ESTIBAS-ejemplo.xlsx","ESTIBAS-ejemplo.xlsx"));}catch(error){notify(error instanceof Error?error.message:"No se pudo cargar el archivo de ejemplo.","error");}};
  const loadLots=async()=>{try{await importLots(await exampleFile("/examples/Lotes_2016_2026.xlsx","Lotes_2016_2026.xlsx"));}catch(error){notify(error instanceof Error?error.message:"No se pudo cargar el archivo de lotes.","error");}};
  const syncOrders=async()=>{setBusy("sheets");try{const params=new URLSearchParams({spreadsheetId:settings.spreadsheetId});const response=await fetch(apiUrl(`/api/google-sheets?${params}`),{cache:"no-store",headers:{"cache-control":"no-cache"}});const result=await response.json() as {orders?:ProductionOrder[];synchronizedAt?:string;error?:string};if(!response.ok)throw new Error(result.error||"No se pudo leer Google Sheets.");const fresh=result.orders??[];setOrders(previous=>fresh.map(item=>{const old=previous.find(value=>value.id===item.id||(value.pn===item.pn&&value.internalCode===item.internalCode&&value.lineNumber===item.lineNumber));return {...item,veCompleted:old?.veCompleted??requests.some(r=>r.pn===item.pn&&r.productCode===item.internalCode),highlightedNew:old?old.highlightedNew:false};}));addAudit("Sincronización","Google Sheets",`${fresh.length} pedidos VESTIR leídos en vivo; líneas 1, 2 y 3`);notify(`Programación actualizada: ${fresh.length} pedidos; los agregados quedan amarillos.`);}catch(error){notify(error instanceof Error?error.message:"No se pudo actualizar Google Sheets.","error");}finally{setBusy(null);}};
  const chooseOrder=(order:ProductionOrder)=>{setActiveOrder(order);setSelected(new Set());setPage("ve");};
  const generate=(request:VeRequest)=>{setRequests(current=>[request,...current]);setOrders(current=>current.map(order=>order.pn===request.pn&&order.internalCode===request.productCode?{...order,veCompleted:true,highlightedNew:false}:order));const used=new Map((request.allocations??[]).map(item=>[item.stackId,item.usedBottles]));setStacks(current=>current.map(s=>{const consumed=used.get(s.id)??0;if(!consumed)return s;const availableQuantity=Math.max(0,s.availableQuantity-consumed);return {...s,used:availableQuantity===0,availableQuantity,extraData:{...s.extraData,consumptions:[...((s.extraData.consumptions as unknown[])??[]),{requestNumber:request.number,pn:request.pn,bottles:consumed}]}};}));addAudit("Generación","Solicitud VE",`${request.number} · ${request.client} · ${(request.allocations??[]).length} estibas`);notify(`${request.number} guardada y pedido marcado como realizado.`);};
  const deleteRequest=(request:VeRequest)=>{setStacks(current=>restoreRequestConsumption(current,request));setRequests(current=>current.filter(item=>item.id!==request.id));setOrders(current=>current.map(order=>order.pn===request.pn&&order.internalCode===request.productCode?{...order,veCompleted:false,highlightedNew:true}:order));addAudit("Eliminación","Solicitud VE",`${request.number} eliminada; ${(request.allocations??[]).reduce((n,item)=>n+item.usedBottles,0)} botellas devueltas al stock`);notify(`${request.number} eliminada. El stock utilizado fue recuperado.`);};
  const saveSettings=(value:AppSettings)=>{if(value.expirationDays<=0||value.urgentDays<0||value.warningDays<=value.urgentDays||value.expirationDays<=value.warningDays){notify("Revise los parámetros: alerta urgente < preventiva < vencimiento.","error");return;}setSettings(value);addAudit("Configuración","Parámetros",`Vencimiento ${value.expirationDays} días; alertas ${value.urgentDays}/${value.warningDays}`);notify("Configuración guardada.");};
  const changeOwnPassword=async()=>{if(!loggedUser)return;if(await passwordHash(passwordDraft.current)!==loggedUser.credentialHash){notify("La contraseña actual no es correcta.","error");return;}if(passwordDraft.next.length<4){notify("La nueva contraseña debe tener al menos 4 caracteres.","error");return;}if(passwordDraft.next!==passwordDraft.confirm){notify("La confirmación no coincide.","error");return;}const credentialHash=await passwordHash(passwordDraft.next);setUsers(current=>current.map(user=>user.id===loggedUser.id?{...user,credentialHash}:user));addAudit("Cambio de contraseña","Seguridad",loggedUser.username);setPasswordDraft({current:"",next:"",confirm:""});setShowPassword(false);notify("Contraseña actualizada correctamente.");};
  if(!isHydrated)return <div className="login-shell"><div className="login-card"><div className="brand-mark">VE</div><h1>Gestión de Estibas</h1><p>Recuperando datos…</p></div></div>;
  if(!loggedUser)return <SecureLoginScreen users={users} onLogin={user=>{window.sessionStorage.setItem("ve-user",user.id);setLoggedUserId(user.id);addAudit("Inicio de sesión","Seguridad",user.username);}}/>;
  let screen:React.ReactNode;
  if(page==="dashboard") screen=<Dashboard evaluated={evaluated} counts={counts} filter={filter} onFilter={setFilter} go={setPage}/>;
  else if(page==="stacks") screen=<StacksScreen stacks={evaluated} initialStatus={filter} search={stackSearch} onSearch={setStackSearch} selected={selected} onSelected={setSelected} onImportStacks={importStacks} onImportLots={importLots} onLoadExampleStacks={loadStacks} onLoadExampleLots={loadLots} onGoVe={()=>setPage("ve")} busy={busy} importSummary={importSummary}/>;
  else if(page==="orders") screen=<OrdersScreen orders={orders} onSync={syncOrders} onSelect={chooseOrder} onToggle={id=>setOrders(current=>current.map(order=>order.id===id?{...order,veCompleted:!order.veCompleted,highlightedNew:false}:order))} busy={busy==="sheets"}/>;
  else if(page==="ve") screen=<VeScreen key={activeOrder?.id ?? "order-picker"} orders={orders} activeOrder={activeOrder} onOrder={setActiveOrder} stacks={evaluated} selected={selected} onSelected={setSelected} onGenerate={generate} onGoStacks={()=>setPage("stacks")}/>;
  else if(page==="history") screen=<HistoryScreen requests={requests} onRequests={setRequests} onDelete={deleteRequest}/>;
  else if(currentRole==="Administrador") screen=<AdminScreen catalogs={catalogs} onCatalogs={value=>{setCatalogs(value);addAudit("Actualización","Catálogos","Se modificaron valores maestros");}} users={users} onUsers={value=>{setUsers(value);addAudit("Actualización","Usuarios","Se modificaron usuarios o roles");}} settings={settings} onSettings={saveSettings} audit={audit} onPasswordAudit={username=>addAudit("Cambio de contraseña por administrador","Seguridad",username)}/>;
  else screen=<Dashboard evaluated={evaluated} counts={counts} filter={filter} onFilter={setFilter} go={setPage}/>;

  return <div className="app-frame">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">VE</div><div><strong>Estibas</strong><small>Fraccionamiento</small></div></div>
      <nav><p>OPERACIÓN</p>{nav.slice(0,5).map(([key,label,Icon]) => <button key={key} className={page===key?"nav-item active":"nav-item"} onClick={()=>{if(key==="stacks")setFilter("all");setPage(key);}}><Icon size={18}/><span>{label}</span>{key==="stacks"&&counts.byStatus.expired?<b>{counts.byStatus.expired}</b>:null}</button>)}
        {currentRole==="Administrador"?<><p className="system-label">SISTEMA</p>{nav.slice(5).map(([key,label,Icon]) => <button key={key} className={page===key?"nav-item active":"nav-item"} onClick={()=>setPage(key)}><Icon size={18}/><span>{label}</span></button>)}</>:null}</nav>
      <div className="sidebar-bottom"><div className={`sync persistence-${persistence}`}><i/> {persistence==="loading"?"Recuperando datos…":persistence==="saving"?"Guardando cambios…":persistence==="error"?"Sin persistencia":"Cambios guardados"}</div><div className="user-profile"><div className="user"><CircleUserRound size={30}/><div><strong>{viewerName}</strong><small>{currentRole}</small></div></div><button onClick={()=>setShowPassword(true)}>Cambiar mi contraseña</button><button onClick={()=>{addAudit("Cierre de sesión","Seguridad",loggedUser.username);window.sessionStorage.removeItem("ve-user");setLoggedUserId(null);setPage("dashboard");}}><LogOut size={14}/> Cerrar sesión</button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><label className="global-search"><Search size={17}/><input aria-label="Buscar" value={stackSearch} onChange={event=>setStackSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")setPage("stacks");}} placeholder="Buscar estiba, lote, producto o cliente…"/><kbd>↵</kbd></label><div className="top-actions"><span><Database size={15}/> {stacks.length.toLocaleString("es-AR")} estibas activas</span>{currentRole==="Administrador"?<button aria-label="Usuarios" onClick={()=>setPage("admin")}><Users size={18}/></button>:null}</div></header>
      <div className="content">{screen}</div>
    </main>
    <nav className="mobile-nav">{nav.slice(0,5).map(([key,label,Icon])=><button key={key} className={page===key?"active":""} onClick={()=>{if(key==="stacks")setFilter("all");setPage(key);}}><Icon size={18}/><span>{label}</span></button>)}</nav>
    {toast?<div className={`toast ${toast.tone}`}><span>{toast.tone==="ok"?"✓":"!"}</span>{toast.message}</div>:null}
    {showPassword?<div className="modal-backdrop"><form className="password-modal" onSubmit={event=>{event.preventDefault();void changeOwnPassword();}}><h2>Cambiar mi contraseña</h2><p>Ingrese su contraseña actual y elija una nueva.</p><label>Contraseña actual<input autoFocus type="password" value={passwordDraft.current} onChange={event=>setPasswordDraft({...passwordDraft,current:event.target.value})}/></label><label>Nueva contraseña<input type="password" value={passwordDraft.next} onChange={event=>setPasswordDraft({...passwordDraft,next:event.target.value})}/></label><label>Confirmar contraseña<input type="password" value={passwordDraft.confirm} onChange={event=>setPasswordDraft({...passwordDraft,confirm:event.target.value})}/></label><div><button type="button" className="secondary" onClick={()=>{setShowPassword(false);setPasswordDraft({current:"",next:"",confirm:""});}}>Cancelar</button><button className="primary" type="submit">Guardar contraseña</button></div></form></div>:null}
  </div>;
}

async function passwordHash(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
function LoginScreen({users,onLogin}:{users:AppUser[];onLogin:(user:AppUser)=>void}){const [username,setUsername]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const submit=async(event:React.FormEvent)=>{event.preventDefault();const hash=await passwordHash(password);const user=users.find(item=>item.active&&item.username.toLowerCase()===username.trim().toLowerCase()&&item.credentialHash===hash);if(!user){setError("Usuario o contraseña incorrectos.");return;}onLogin(user);};return <div className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand-mark">VE</div><span>Fraccionamiento</span><h1>Gestión de Estibas</h1><p>Ingrese con su usuario interno.</p><label>Usuario<input autoFocus value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username"/></label><label>Contraseña<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password"/></label>{error?<div className="login-error">{error}</div>:null}<button className="primary" type="submit">Ingresar</button><small>Acceso inicial: admin / 1234</small></form></div>}

function Dashboard({evaluated,counts,filter,onFilter,go}:{evaluated:EvaluatedStack[];counts:{total:number;byStatus:Record<ExpiryStatus,number>;available:number;used:number;bottles:number};filter:ExpiryStatus|"all";onFilter:(s:ExpiryStatus|"all")=>void;go:(p:PageKey)=>void}) {
  const chartStatuses:ExpiryStatus[]=["expired","under15","under30","ok"];
  const total=Math.max(1,chartStatuses.reduce((n,s)=>n+counts.byStatus[s],0)); let current=0;
  const gradient=chartStatuses.map(s=>{const from=current/total*100;current+=counts.byStatus[s];return `${meta[s].color} ${from}% ${current/total*100}%`;}).join(",");
  const critical=evaluated.filter(s=>["expired","under15","under30"].includes(s.expiryStatus));
  const products=Object.entries(evaluated.reduce<Record<string,number>>((a,s)=>{const k=s.product.split(" ").slice(0,2).join(" ");a[k]=(a[k]??0)+s.availableQuantity;return a;},{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const clients=Object.entries(evaluated.reduce<Record<string,number>>((a,s)=>{const k=s.client||"No informado";a[k]=(a[k]??0)+s.availableQuantity;return a;},{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const max=Math.max(...products.map(([,v])=>v),1);
  const maxClient=Math.max(...clients.map(([,v])=>v),1);
  const openStatus=(status:ExpiryStatus|"all")=>{onFilter(status);go("stacks");};
  return <>
    <section className="page-heading"><div><div className="eyebrow"><i/> Control operativo · 18 julio 2026</div><h1>Tablero de estibas</h1><p>Prioridad FEFO y control automático de los 90 días desde la elaboración.</p></div><div className="heading-actions"><button className="secondary" onClick={()=>go("stacks")}><FileSpreadsheet size={17}/> Importar archivos</button><button className="primary" onClick={()=>go("ve")}><Sparkles size={17}/> Generar Solicitud VE</button></div></section>
    <section className="metric-grid">
      <Metric icon={Boxes} label="Estibas registradas" value={counts.total} detail={`${counts.bottles.toLocaleString("es-AR")} botellas disponibles`} tone="neutral"/>
      <Metric icon={AlertTriangle} label="Vencidas" value={counts.byStatus.expired} detail="Requieren definición inmediata" tone="red" active={filter==="expired"} onClick={()=>openStatus("expired")}/>
      <Metric icon={CalendarClock} label="Próximas a vencer" value={counts.byStatus.under15+counts.byStatus.under30} detail={`${counts.byStatus.under15} en los próximos 15 días`} tone="orange" onClick={()=>openStatus("all")}/>
      <Metric icon={PackageCheck} label="Disponibles" value={counts.available} detail={`${counts.used} estibas ya utilizadas`} tone="green"/>
    </section>
    <section className="dashboard-grid">
      <article className="panel"><PanelHead title="Estado de vencimientos" text="Estibas con fecha calculada" action={<button className="text-button" onClick={()=>openStatus("all")}>Ver todas</button>}/><div className="status-wrap"><div className="donut" style={{background:`conic-gradient(${gradient})`}}><div><strong>{total}</strong><small>con fecha</small></div></div><div className="legend">{chartStatuses.map(s=><button key={s} className={filter===s?"legend-row selected":"legend-row"} onClick={()=>openStatus(s)}><i style={{background:meta[s].color}}/><span>{meta[s].label}</span><strong>{counts.byStatus[s]}</strong><small>{Math.round(counts.byStatus[s]/total*100)}%</small></button>)}<div className="quality"><Database size={14}/> {counts.byStatus.missingLot+counts.byStatus.unsupported} requieren datos.</div></div></div></article>
      <article className="panel"><PanelHead title="Botellas por producto" text="Stock disponible en la simulación" action={<BarChart3 size={18}/>}/><div className="bars">{products.map(([name,value])=><div className="bar-row" key={name}><div><span>{name}</span><strong>{value.toLocaleString("es-AR")}</strong></div><div className="bar-track"><i style={{width:`${Math.max(8,value/max*100)}%`}}/></div></div>)}</div></article>
      <article className="panel"><PanelHead title="Botellas por cliente" text="Principales destinos del stock" action={<Users size={18}/>}/><div className="bars">{clients.map(([name,value])=><div className="bar-row" key={name}><div><span>{name}</span><strong>{value.toLocaleString("es-AR")}</strong></div><div className="bar-track client"><i style={{width:`${Math.max(8,value/maxClient*100)}%`}}/></div></div>)}</div></article>
    </section>
    <section className="panel priority"><PanelHead title="Prioridad de uso" text="Primero se muestran las estibas con menor vida útil remanente." action={<button className="quiet" onClick={()=>go("stacks")}>Abrir gestión <span>→</span></button>}/><div className="table-scroll"><table><thead><tr><th>Prioridad</th><th>Código / pallet</th><th>Producto</th><th>Lote</th><th>Elaboración</th><th>Vencimiento</th><th>Días</th><th>Cantidad</th><th>Estado</th></tr></thead><tbody>{critical.slice(0,7).map((s,i)=><tr key={s.id}><td><em>{String(i+1).padStart(2,"0")}</em></td><td><strong className="mono">{s.barcode}</strong><small>Pallet {s.pallet} · {s.line}</small></td><td><strong>{s.product}</strong><small>{s.productCode} · {s.client}</small></td><td className="mono">{s.lot}</td><td>{formatDate(s.elaborationDate)}</td><td>{formatDate(s.expiryDate)}</td><td className={s.daysRemaining!==null&&s.daysRemaining<0?"negative":""}><strong>{s.daysRemaining??"—"}</strong></td><td>{s.availableQuantity.toLocaleString("es-AR")}</td><td><Status status={s.expiryStatus}/></td></tr>)}</tbody></table></div></section>
    <section className="source-strip"><Source icon={FileSpreadsheet} title="ESTIBAS.xlsx" text="30 columnas · 602 registros reales"/><Source icon={CalendarClock} title="Lotes 2026.xlsx" text="365 lotes vinculados"/><Source icon={Database} title="Google Sheets" text="3 semanas · modo simulado"/></section>
  </>;
}

function Metric({icon:Icon,label,value,detail,tone,onClick,active}:{icon:typeof Boxes;label:string;value:number;detail:string;tone:string;onClick?:()=>void;active?:boolean}) { const Tag=onClick?"button":"article"; return <Tag className={`metric ${tone} ${active?"selected":""}`} onClick={onClick}><div className="metric-icon"><Icon size={20}/></div><div><span>{label}</span><strong>{value.toLocaleString("es-AR")}</strong><small>{detail}</small></div></Tag>; }
function PanelHead({title,text,action}:{title:string;text:string;action:React.ReactNode}) { return <div className="panel-head"><div><h2>{title}</h2><p>{text}</p></div>{action}</div>; }
function Status({status}:{status:ExpiryStatus}) { return <span className={`status ${status}`}><i/>{statusLabel(status)}</span>; }
function Source({icon:Icon,title,text}:{icon:typeof Database;title:string;text:string}) { return <div><Icon size={20}/><span><strong>{title}</strong><small>{text}</small></span></div>; }
