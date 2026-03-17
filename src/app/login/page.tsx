"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  return (
    <main style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:"#f8fafd",fontFamily:"'Google Sans','Segoe UI',system-ui,sans-serif"}}>
      <header style={{display:"flex",alignItems:"center",gap:16,padding:"12px 48px",background:"white",borderBottom:"1px solid #e8eaed"}}>
        <Image src="/logo-unchk.png" alt="UN-CHK" width={130} height={52} style={{objectFit:"contain"}} priority />
        <div style={{width:1.5,height:40,background:"#e8eaed"}} />
        <span style={{fontSize:"0.95rem",fontWeight:700,color:"#2d4a6e"}}>📡 Plateforme de Diffusion en Direct</span>
      </header>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
        <div style={{background:"white",borderRadius:16,padding:"48px 40px",width:"100%",maxWidth:420,boxShadow:"0 8px 40px rgba(0,0,0,.10)",textAlign:"center"}}>
          <div style={{width:64,height:64,borderRadius:16,background:"#e8f0fe",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem",margin:"0 auto 24px"}}>🔐</div>
          <h1 style={{fontSize:"1.5rem",fontWeight:700,color:"#202124",marginBottom:8}}>Connexion requise</h1>
          <p style={{fontSize:"0.9rem",color:"#5f6368",marginBottom:32,lineHeight:1.6}}>
            Connectez-vous avec votre compte UN-CHK pour accéder à la plateforme de diffusion en direct.
          </p>
          <button
            onClick={() => signIn("keycloak", { callbackUrl })}
            style={{width:"100%",padding:"14px 24px",background:"#0065b1",color:"white",border:"none",borderRadius:10,fontSize:"1rem",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontFamily:"inherit"}}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Se connecter avec SenID
          </button>
          <p style={{marginTop:24,fontSize:"0.78rem",color:"#9aa0a6"}}>Authentification sécurisée via SSO UN-CHK</p>
        </div>
      </div>
      <footer style={{background:"white",borderTop:"2px solid rgba(0,101,177,0.12)",padding:"20px 48px",textAlign:"center"}}>
        <p style={{fontSize:"0.82rem",color:"#5f6368"}}>Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
        <p style={{fontSize:"0.75rem",color:"#9aa0a6",marginTop:4}}>© DITSI - UN-CHK - 2025</p>
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>;
}
