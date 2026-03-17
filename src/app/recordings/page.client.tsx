"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Recording = {
  key: string;
  size: number;
  lastModified: string;
  url: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function formatName(key: string) {
  const parts = key.split("/");
  const file = parts[parts.length - 1];
  const room = parts[0];
  return { room, file };
}

export default function RecordingsClient() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecordings = async (silent = false) => {
    if (!silent) { setLoading(true); setError(""); }
    try {
      const r = await fetch("/api/recordings");
      const d = await r.json();
      setRecordings(d.files || []);
    } catch {
      setError("Impossible de charger les enregistrements");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
    const interval = setInterval(() => fetchRecordings(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRecordings();
  };

  return (
    <div className="rec-root">
      {/* HEADER */}
      <header className="rec-header">
        <div className="rec-logo">
          <Image
            src="/logo-unchk.png"
            alt="Université Numérique Cheikh Hamidou Kane"
            width={130}
            height={52}
            priority
            style={{ objectFit: 'contain' }}
          />
          <div className="rec-logo-divider" />
          <span className="rec-logo-platform">📡 Plateforme de Diffusion en Direct</span>
        </div>
        <nav className="rec-nav">
          <a href="/" className="rec-nav-link">← Accueil</a>
          <a href="mailto:aide.apprentissage@unchk.edu.sn" className="rec-nav-link">Support</a>
          <button className="rec-btn-outline">Se connecter</button>
        </nav>
      </header>

      <main className="rec-main">
        <div className="rec-title-row">
          <h1 className="rec-title">📼 Enregistrements</h1>
          <button className="rec-refresh" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "↻ Actualisation..." : "↻ Actualiser"}
          </button>
        </div>

        {loading && !refreshing && (
          <div className="rec-loading">
            <span className="rec-spinner" />
            Chargement des enregistrements...
          </div>
        )}

        {error && <div className="rec-error">{error}</div>}

        {!loading && recordings.length === 0 && !error && (
          <div className="rec-empty">
            <div className="rec-empty-icon">📭</div>
            <p>Aucun enregistrement disponible</p>
            <p className="rec-empty-sub">Les enregistrements apparaîtront ici après la fin d'une session</p>
          </div>
        )}

        {!loading && recordings.length > 0 && (
          <>
            <p className="rec-count">
              {recordings.length} enregistrement{recordings.length > 1 ? "s" : ""} disponible{recordings.length > 1 ? "s" : ""}
            </p>
            <div className="rec-grid">
              {recordings.map(rec => {
                const { room, file } = formatName(rec.key);
                const isPlaying = playingKey === rec.key;
                return (
                  <div key={rec.key} className={`rec-card${isPlaying ? " rec-card--active" : ""}`}>
                    {/* Infos + boutons */}
                    <div className="rec-card-top">
                      <div className="rec-card-icon">🎥</div>
                      <div className="rec-card-info">
                        <div className="rec-card-room">{room}</div>
                        <div className="rec-card-file">{file}</div>
                        <div className="rec-card-meta">
                          <span>🕐 {formatDate(rec.lastModified)}</span>
                          <span className="rec-dot">·</span>
                          <span>💾 {formatSize(rec.size)}</span>
                        </div>
                      </div>
                      <div className="rec-actions">
                        <button
                          className={isPlaying ? "rec-btn-close" : "rec-btn-play"}
                          onClick={() => setPlayingKey(isPlaying ? null : rec.key)}
                        >
                          {isPlaying ? "✖ Fermer" : "▶ Voir"}
                        </button>
                        <a
                          href={`/api/download-recording?key=${encodeURIComponent(rec.key)}`}
                          className="rec-btn-dl"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          ⬇ Télécharger
                        </a>
                      </div>
                    </div>

                    {/* Player vidéo inline */}
                    {isPlaying && (
                      <div className="rec-player">
                        <video
                          controls
                          autoPlay
                          style={{ width: "100%", maxHeight: "500px", borderRadius: "8px", background: "#000" }}
                          src={`/api/download-recording?key=${encodeURIComponent(rec.key)}`}
                        >
                          Votre navigateur ne supporte pas la lecture vidéo.
                        </video>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="rec-footer">
        <p className="rec-footer-ministry">Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation (MESRI)</p>
        <p className="rec-footer-university">Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
        <p className="rec-footer-copy">© DITSI - UN-CHK - 2025 - Tous droits réservés</p>
      </footer>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#f8fafd;font-family:'Google Sans','Segoe UI',system-ui,sans-serif;color:#202124;}
        .rec-root{min-height:100vh;display:flex;flex-direction:column;}

        /* Header */
        .rec-header{display:flex;align-items:center;justify-content:space-between;padding:12px 48px;background:white;border-bottom:1px solid #e8eaed;position:sticky;top:0;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .rec-logo{display:flex;align-items:center;gap:16px;}
        .rec-logo-divider{width:1.5px;height:40px;background:#e8eaed;flex-shrink:0;}
        .rec-logo-platform{font-size:0.95rem;font-weight:700;color:#2d4a6e;}
        .rec-nav{display:flex;align-items:center;gap:20px;}
        .rec-nav-link{text-decoration:none;color:#5f6368;font-size:0.9rem;transition:color .2s;}
        .rec-nav-link:hover{color:#0065b1;}
        .rec-btn-outline{padding:8px 20px;border:1.5px solid #0065b1;border-radius:8px;background:white;color:#0065b1;font-size:0.875rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .2s;}
        .rec-btn-outline:hover{background:#e8f0fe;}

        /* Main */
        .rec-main{padding:48px;max-width:1000px;margin:0 auto;width:100%;flex:1;}
        .rec-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
        .rec-title{font-size:1.8rem;font-weight:700;color:#202124;}
        .rec-count{font-size:0.9rem;color:#0065b1;font-weight:600;margin-bottom:24px;}
        .rec-refresh{padding:8px 16px;background:white;border:1.5px solid #dadce0;border-radius:8px;font-size:0.85rem;color:#5f6368;cursor:pointer;font-family:inherit;transition:background .2s;}
        .rec-refresh:hover:not(:disabled){background:#f1f3f4;}
        .rec-refresh:disabled{opacity:.6;cursor:not-allowed;}
        .rec-loading{display:flex;align-items:center;gap:12px;color:#5f6368;font-size:0.95rem;padding:48px 0;}
        .rec-spinner{width:20px;height:20px;border:2px solid #dadce0;border-top-color:#0065b1;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .rec-error{color:#ea4335;padding:16px;background:#fce8e6;border-radius:8px;margin-bottom:24px;}
        .rec-empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:80px 0;color:#5f6368;}
        .rec-empty-icon{font-size:3rem;}
        .rec-empty p{font-size:1rem;font-weight:500;}
        .rec-empty-sub{font-size:0.85rem;color:#9aa0a6;}

        /* Cards */
        .rec-grid{display:flex;flex-direction:column;gap:16px;}
        .rec-card{background:white;border:1px solid #e8eaed;border-radius:12px;overflow:hidden;transition:box-shadow .2s;}
        .rec-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08);}
        .rec-card--active{border-color:rgba(0,101,177,0.3);box-shadow:0 4px 20px rgba(0,101,177,.1);}
        .rec-card-top{display:flex;align-items:center;gap:16px;padding:20px 24px;}
        .rec-card-icon{font-size:2rem;flex-shrink:0;}
        .rec-card-info{flex:1;min-width:0;}
        .rec-card-room{font-size:0.75rem;color:#0065b1;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;}
        .rec-card-file{font-size:0.95rem;font-weight:500;color:#202124;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .rec-card-meta{display:flex;gap:8px;align-items:center;font-size:0.8rem;color:#9aa0a6;margin-top:4px;}
        .rec-dot{color:#dadce0;}
        .rec-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;}
        .rec-btn-play{display:flex;align-items:center;gap:6px;padding:10px 20px;background:#0065b1;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .2s;}
        .rec-btn-play:hover{background:#004d8c;}
        .rec-btn-close{display:flex;align-items:center;gap:6px;padding:10px 20px;background:#5f6368;color:white;border:none;border-radius:8px;font-size:0.85rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .2s;}
        .rec-btn-close:hover{background:#3c4043;}
        .rec-btn-dl{display:flex;align-items:center;gap:6px;padding:10px 20px;background:white;color:#1e7e34;border:1.5px solid rgba(30,126,52,0.3);border-radius:8px;font-size:0.85rem;font-weight:500;text-decoration:none;transition:all .2s;}
        .rec-btn-dl:hover{background:#e8f5e9;border-color:#1e7e34;}

        /* Player */
        .rec-player{padding:0 24px 24px;border-top:1px solid #e8eaed;padding-top:16px;}

        /* Footer */
        .rec-footer{background:white;border-top:2px solid rgba(0,101,177,0.12);padding:28px 48px;text-align:center;display:flex;flex-direction:column;gap:5px;margin-top:auto;}
        .rec-footer-ministry{font-size:0.82rem;color:#5f6368;}
        .rec-footer-university{font-size:1rem;font-weight:700;color:#0065b1;}
        .rec-footer-copy{font-size:0.75rem;color:#9aa0a6;}

        @media(max-width:600px){
          .rec-header{padding:12px 20px;}
          .rec-logo-divider,.rec-logo-platform{display:none;}
          .rec-main{padding:24px 16px;}
          .rec-card-top{flex-direction:column;align-items:flex-start;}
          .rec-actions{width:100%;}
          .rec-btn-play,.rec-btn-close,.rec-btn-dl{flex:1;justify-content:center;}
          .rec-footer{padding:24px;}
        }
      `}</style>
    </div>
  );
}
