"use client";
import Image from "next/image";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import CreateStreamDialog from "@/components/create-stream-dialog";
import ObsDialog from "@/components/obs-dialog";

function JoinRoomDialog({ onClose }: { onClose: () => void }) {
  const [roomName, setRoomName] = useState("");
  const handleJoin = () => {
    const room = roomName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!room) return;
    window.location.href = `/watch/${room}`;
  };
  return (
    <div className="jr-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="jr-modal">
        <div className="jr-header">
          <div className="jr-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" stroke="#0065b1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <div><h2 className="jr-title">Rejoindre une salle</h2><p className="jr-desc">Entrez le nom de la salle pour rejoindre</p></div>
          <button className="jr-close" onClick={onClose}>✕</button>
        </div>
        <div className="jr-body">
          <label className="jr-label">Nom de la salle</label>
          <input className="jr-input" type="text" placeholder="ex: introduction-machine-learning" value={roomName} onChange={(e) => setRoomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} autoFocus />
          <p className="jr-hint">Le nom est visible dans l'URL partagée par l'animateur.</p>
        </div>
        <div className="jr-footer">
          <button className="jr-btn-cancel" onClick={onClose}>Annuler</button>
          <button className="jr-btn-join" onClick={handleJoin} disabled={!roomName.trim()}>Rejoindre</button>
        </div>
      </div>
      <style>{`
        .jr-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:100;animation:fadeIn .15s ease;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .jr-modal{background:white;border-radius:16px;width:100%;max-width:460px;box-shadow:0 24px 64px rgba(0,0,0,.22);animation:slideUp .2s ease;}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        .jr-header{display:flex;align-items:flex-start;gap:14px;padding:24px 24px 0;position:relative;}
        .jr-icon{width:44px;height:44px;border-radius:10px;background:#e8f0fe;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .jr-title{font-size:1.1rem;font-weight:600;color:#202124;}
        .jr-desc{font-size:0.82rem;color:#5f6368;margin-top:2px;}
        .jr-close{position:absolute;right:20px;top:20px;width:32px;height:32px;border-radius:50%;border:none;background:transparent;cursor:pointer;font-size:1rem;color:#5f6368;}
        .jr-close:hover{background:#f1f3f4;}
        .jr-body{padding:20px 24px;display:flex;flex-direction:column;gap:8px;}
        .jr-label{font-size:0.85rem;font-weight:500;color:#3c4043;}
        .jr-input{padding:11px 14px;border:1.5px solid #dadce0;border-radius:8px;font-size:0.95rem;color:#202124;outline:none;transition:border-color .2s;font-family:inherit;}
        .jr-input:focus{border-color:#0065b1;box-shadow:0 0 0 3px rgba(26,115,232,.12);}
        .jr-input::placeholder{color:#9aa0a6;}
        .jr-hint{font-size:0.78rem;color:#9aa0a6;}
        .jr-footer{padding:16px 24px;display:flex;justify-content:flex-end;gap:12px;border-top:1px solid #e8eaed;}
        .jr-btn-cancel{padding:10px 20px;border:1.5px solid #dadce0;border-radius:8px;background:white;color:#5f6368;font-size:0.9rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .jr-btn-cancel:hover{background:#f1f3f4;}
        .jr-btn-join{padding:10px 22px;background:#0065b1;color:white;border:none;border-radius:8px;font-size:0.9rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .jr-btn-join:disabled{opacity:.5;cursor:not-allowed;}
      `}</style>
    </div>
  );
}

export default function HomePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showObs, setShowObs] = useState(false);
  const { data: session, status } = useSession();
  const keycloakEnabled = process.env.NEXT_PUBLIC_KEYCLOAK_ENABLED === "true";
  const displayName = session?.user?.name || session?.user?.email || "";

  return (
    <main className="gm-main">
      <header className="gm-header">
        <div className="gm-logo">
          <Image src="/logo-unchk.png" alt="Université Numérique Cheikh Hamidou Kane" width={130} height={52} priority style={{ objectFit: 'contain' }} />
          <div className="gm-logo-divider" />
          <span className="gm-logo-platform">📡 Plateforme de Diffusion en Direct</span>
        </div>
        <nav className="gm-nav">
          <a href="mailto:aide.apprentissage@unchk.edu.sn" className="gm-nav-link">Support</a>
          {keycloakEnabled && status !== "loading" ? (
            session ? (
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:"0.85rem",color:"#5f6368",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  👤 {displayName}
                </span>
                <button className="gm-btn-outline" onClick={() => signOut({ callbackUrl: "/" })}>Déconnexion</button>
              </div>
            ) : (
              <button className="gm-btn-outline" onClick={() => signIn("keycloak")}>Se connecter</button>
            )
          ) : (
            !keycloakEnabled && <button className="gm-btn-outline">Se connecter</button>
          )}
        </nav>
      </header>

      <section className="gm-hero">
        <div className="gm-hero-content">
          <h1 className="gm-title">Enseignez en direct,<br /><span className="gm-title-accent">partout dans le monde</span></h1>
          <p className="gm-subtitle">Organisez des webinaires, des cours ou des événements en direct avec une latence inférieure à 100 ms. Diffusez depuis le navigateur ou OBS Studio.</p>
          <div className="gm-actions">
            <button className="gm-btn-primary" onClick={() => keycloakEnabled && !session ? signIn("keycloak") : setShowCreate(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Créer un stream
            </button>
            <button className="gm-btn-secondary" onClick={() => keycloakEnabled && !session ? signIn("keycloak") : setShowObs(true)}>📡 Diffuser via OBS</button>
            <button className="gm-btn-orange" onClick={() => setShowJoin(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Rejoindre une salle
            </button>
            <button className="gm-btn-green" onClick={() => window.location.href="/recordings"}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><polygon points="10,8 16,12 10,16" fill="currentColor" /></svg>
              Voir les enregistrements
            </button>
          </div>
        </div>
        <div className="gm-hero-visual">
          <div className="gm-preview-card">
            <div className="gm-preview-header"><span className="gm-live-badge">● EN DIRECT</span><span className="gm-viewer-count">1 247 spectateurs</span></div>
            <div className="gm-preview-screen">
              <div className="gm-avatar-grid">
                {["A","B","C","D"].map((l,i)=>(
                  <div key={i} className={`gm-avatar gm-avatar--${i}`}><span>{l}</span>{i===0&&<div className="gm-speaking-ring"/>}</div>
                ))}
              </div>
            </div>
            <div className="gm-preview-controls">
              <div className="gm-ctrl gm-ctrl--active">🎤</div><div className="gm-ctrl">📷</div><div className="gm-ctrl gm-ctrl--red">📵</div>
            </div>
          </div>
        </div>
      </section>

      <section className="gm-features">
        {[
          {icon:"⚡",title:"Latence < 100ms",desc:"WebRTC sur backbone Internet, dernière mile seulement via Internet public."},
          {icon:"🙋",title:"Lever la main",desc:"Les participants peuvent demander à prendre la parole. L'animateur accepte ou refuse."},
          {icon:"🖥️",title:"Partage d'écran",desc:"Les intervenants invités peuvent partager leur écran, micro et caméra."},
          {icon:"📡",title:"Multi-plateformes",desc:"Diffusez vers YouTube, SunuTube et tout serveur RTMP simultanément."},
        ].map((f,i)=>(<div key={i} className="gm-feature-card"><div className="gm-feature-icon">{f.icon}</div><h3>{f.title}</h3><p>{f.desc}</p></div>))}
      </section>

      <footer style={{background:'white',borderTop:'2px solid rgba(0,101,177,0.12)',padding:'28px 48px',textAlign:'center',marginTop:'auto'}}>
        <p style={{fontSize:'0.82rem',color:'#5f6368'}}>Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation (MESRI)</p>
        <p style={{fontSize:'1rem',fontWeight:700,color:'#0065b1',margin:'4px 0'}}>Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
        <p style={{fontSize:'0.75rem',color:'#9aa0a6'}}>© DITSI - UN-CHK - 2025 - Tous droits réservés</p>
      </footer>

      {showCreate && <CreateStreamDialog onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinRoomDialog onClose={() => setShowJoin(false)} />}
      {showObs && <ObsDialog onClose={() => setShowObs(false)} />}

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#f8fafd;font-family:'Google Sans','Segoe UI',system-ui,sans-serif;color:#202124;}
        .gm-main{min-height:100vh;display:flex;flex-direction:column;}
        .gm-header{display:flex;align-items:center;justify-content:space-between;padding:12px 48px;background:white;border-bottom:1px solid #e8eaed;position:sticky;top:0;z-index:10;}
        .gm-logo{display:flex;align-items:center;gap:16px;}
        .gm-logo-divider{width:1.5px;height:40px;background:#e8eaed;flex-shrink:0;}
        .gm-logo-platform{font-size:0.95rem;font-weight:700;color:#2d4a6e;}
        .gm-nav{display:flex;align-items:center;gap:20px;}
        .gm-nav-link{text-decoration:none;color:#5f6368;font-size:0.9rem;}
        .gm-nav-link:hover{color:#0065b1;}
        .gm-btn-outline{padding:8px 20px;border:1.5px solid #0065b1;border-radius:8px;background:white;color:#0065b1;font-size:0.875rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .gm-btn-outline:hover{background:#e8f0fe;}
        .gm-btn-primary{display:flex;align-items:center;gap:8px;padding:12px 24px;background:#0065b1;color:white;border:none;border-radius:8px;font-size:0.95rem;font-weight:500;cursor:pointer;box-shadow:0 1px 3px rgba(26,115,232,.3);font-family:inherit;}
        .gm-btn-primary:hover{background:#004d8c;}
        .gm-btn-secondary{display:flex;align-items:center;gap:8px;padding:12px 24px;background:white;color:#0065b1;border:1.5px solid rgba(0,101,177,0.3);border-radius:8px;font-size:0.95rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .gm-btn-secondary:hover{background:#e8f0fe;border-color:#0065b1;}
        .gm-btn-orange{display:flex;align-items:center;gap:8px;padding:12px 24px;background:white;color:#e37400;border:1.5px solid rgba(227,116,0,0.3);border-radius:8px;font-size:0.95rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .gm-btn-orange:hover{background:#fff3e0;border-color:#e37400;}
        .gm-btn-green{display:flex;align-items:center;gap:8px;padding:12px 24px;background:white;color:#1e7e34;border:1.5px solid rgba(30,126,52,0.3);border-radius:8px;font-size:0.95rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .gm-btn-green:hover{background:#e8f5e9;border-color:#1e7e34;}
        .gm-hero{display:grid;grid-template-columns:1fr 1fr;gap:64px;padding:80px 48px;max-width:1200px;margin:0 auto;width:100%;align-items:center;}
        .gm-title{font-size:3rem;font-weight:700;line-height:1.2;color:#202124;}
        .gm-title-accent{color:#0065b1;}
        .gm-subtitle{margin-top:20px;font-size:1.1rem;color:#5f6368;line-height:1.6;}
        .gm-actions{margin-top:36px;display:flex;flex-direction:column;gap:12px;max-width:340px;}
        .gm-hero-visual{display:flex;justify-content:center;}
        .gm-preview-card{background:#202124;border-radius:16px;overflow:hidden;width:360px;box-shadow:0 8px 40px rgba(0,0,0,.18);}
        .gm-preview-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:#292a2d;}
        .gm-live-badge{color:#ea4335;font-size:0.8rem;font-weight:700;}
        .gm-viewer-count{color:#9aa0a6;font-size:0.8rem;}
        .gm-preview-screen{height:200px;background:#303134;display:flex;align-items:center;justify-content:center;}
        .gm-avatar-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px;}
        .gm-avatar{width:80px;height:80px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;color:white;position:relative;}
        .gm-avatar--0{background:#0065b1;}.gm-avatar--1{background:#34a853;}.gm-avatar--2{background:#e37400;}.gm-avatar--3{background:#2d4a6e;}
        .gm-speaking-ring{position:absolute;inset:-3px;border-radius:14px;border:3px solid #34a853;animation:pulse 1.5s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .gm-preview-controls{display:flex;justify-content:center;gap:16px;padding:14px;background:#292a2d;}
        .gm-ctrl{width:40px;height:40px;border-radius:50%;background:#3c4043;display:flex;align-items:center;justify-content:center;font-size:1rem;}
        .gm-ctrl--active{background:#0065b1;}.gm-ctrl--red{background:#e37400;}
        .gm-features{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;padding:48px;max-width:1200px;margin:0 auto;width:100%;border-top:1px solid #e8eaed;}
        .gm-feature-card{background:white;border-radius:12px;padding:24px;border:1px solid #e8eaed;transition:box-shadow .2s;}
        .gm-feature-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);}
        .gm-feature-icon{font-size:1.8rem;margin-bottom:12px;}
        .gm-feature-card h3{font-size:0.95rem;font-weight:600;margin-bottom:8px;color:#202124;}
        .gm-feature-card p{font-size:0.85rem;color:#5f6368;line-height:1.5;}
        @media(max-width:900px){
          .gm-hero{grid-template-columns:1fr;padding:40px 24px;}
          .gm-features{grid-template-columns:1fr 1fr;padding:32px 24px;}
          .gm-header{padding:12px 20px;}
          .gm-logo-divider{display:none;}
          .gm-logo-platform{display:none;}
          .gm-title{font-size:2rem;}
          .gm-hero-visual{display:none;}
        }
      `}</style>
    </main>
  );
}
