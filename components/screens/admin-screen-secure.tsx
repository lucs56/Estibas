"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import AdminScreen from "./admin-screen";
import type { AppCatalogs,AppSettings,AppUser,AuditEntry } from "@/lib/types";

type Props={catalogs:AppCatalogs;onCatalogs:(value:AppCatalogs)=>void;users:AppUser[];onUsers:(value:AppUser[])=>void;settings:AppSettings;onSettings:(value:AppSettings)=>void;audit:AuditEntry[];onPasswordAudit?:(username:string)=>void};
export default function AdminScreenSecure(props:Props){
  const [open,setOpen]=useState(false),[userId,setUserId]=useState(props.users[0]?.id??""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[message,setMessage]=useState("");
  const save=async()=>{if(password.length<4){setMessage("La contraseña debe tener al menos 4 caracteres.");return;}if(password!==confirm){setMessage("La confirmación no coincide.");return;}const credentialHash=await passwordHash(password),user=props.users.find(item=>item.id===userId);props.onUsers(props.users.map(item=>item.id===userId?{...item,credentialHash}:item));if(user)props.onPasswordAudit?.(user.username);setPassword("");setConfirm("");setMessage("Contraseña actualizada correctamente.");};
  return <div className="admin-secure"><div className="admin-password-action"><button className="secondary" onClick={()=>{setOpen(true);setMessage("");}}><KeyRound size={15}/> Cambiar contraseña de usuario</button></div><AdminScreen {...props}/>{open?<div className="modal-backdrop"><form className="password-modal" onSubmit={event=>{event.preventDefault();void save();}}><h2>Cambiar contraseña de usuario</h2><p>Seleccione una cuenta y asigne una contraseña nueva.</p><label>Usuario<select value={userId} onChange={event=>setUserId(event.target.value)}>{props.users.map(user=><option key={user.id} value={user.id}>{user.name} (@{user.username})</option>)}</select></label><label>Nueva contraseña<input autoFocus type="password" value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirmar contraseña<input type="password" value={confirm} onChange={event=>setConfirm(event.target.value)}/></label>{message?<div className="password-message">{message}</div>:null}<div><button type="button" className="secondary" onClick={()=>{setOpen(false);setPassword("");setConfirm("");setMessage("");}}>Cerrar</button><button className="primary" type="submit">Guardar contraseña</button></div></form></div>:null}</div>;
}
async function passwordHash(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
