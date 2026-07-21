"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import AdminScreen from "./admin-screen";
import type { AppCatalogs,AppSettings,AppUser,AuditEntry } from "@/lib/types";

type Props={catalogs:AppCatalogs;onCatalogs:(value:AppCatalogs)=>void;users:AppUser[];onUsers:(value:AppUser[])=>void;settings:AppSettings;onSettings:(value:AppSettings)=>void;audit:AuditEntry[]};

export default function AdminScreenEnhanced(props:Props){
  const [open,setOpen]=useState(false),[userId,setUserId]=useState(props.users[0]?.id??""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[message,setMessage]=useState("");
  const save=async()=>{if(password.length<4){setMessage("La contraseña debe tener al menos 4 caracteres.");return;}if(password!==confirm){setMessage("La confirmación no coincide.");return;}const credentialHash=await hashPassword(password);props.onUsers(props.users.map(user=>user.id===userId?{...user,credentialHash}:user));setPassword("");setConfirm("");setMessage("Contraseña actualizada correctamente.");};
  return <div className="admin-enhanced"><div className="admin-password-action"><button className="secondary" onClick={()=>{setOpen(true);setMessage("");}}><KeyRound size={15}/> Cambiar contraseña de un usuario</button></div><AdminScreen {...props}/>{open?<div className="modal-backdrop"><form className="password-modal" onSubmit={event=>{event.preventDefault();void save();}}><h2>Cambiar contraseña de usuario</h2><p>El administrador puede asignar una contraseña nueva sin conocer la anterior.</p><label>Usuario<select value={userId} onChange={event=>setUserId(event.target.value)}>{props.users.map(user=><option value={user.id} key={user.id}>{user.name} (@{user.username})</option>)}</select></label><label>Nueva contraseña<input autoFocus type="password" value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirmar contraseña<input type="password" value={confirm} onChange={event=>setConfirm(event.target.value)}/></label>{message?<div className="password-message">{message}</div>:null}<div><button type="button" className="secondary" onClick={()=>{setOpen(false);setPassword("");setConfirm("");setMessage("");}}>Cerrar</button><button type="submit" className="primary">Guardar contraseña</button></div></form></div>:null}</div>;
}

async function hashPassword(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
