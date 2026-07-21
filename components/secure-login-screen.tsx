"use client";

import { useState } from "react";
import type { AppUser } from "@/lib/types";

export default function SecureLoginScreen({users,onLogin}:{users:AppUser[];onLogin:(user:AppUser)=>void}){
  const [username,setUsername]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");
  const submit=async(event:React.FormEvent)=>{event.preventDefault();const hash=await passwordHash(password);const user=users.find(item=>item.active&&item.username.toLowerCase()===username.trim().toLowerCase()&&item.credentialHash===hash);if(!user){setError("Usuario o contraseña incorrectos.");return;}onLogin(user);};
  return <div className="login-shell"><form className="login-card" onSubmit={submit}><div className="brand-mark">VE</div><span>Fraccionamiento</span><h1>Gestión de Estibas</h1><p>Ingrese con su usuario interno.</p><label>Usuario<input autoFocus value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username"/></label><label>Contraseña<input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password"/></label>{error?<div className="login-error">{error}</div>:null}<button className="primary" type="submit">Ingresar</button></form></div>;
}

async function passwordHash(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
