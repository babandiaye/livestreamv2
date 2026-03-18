"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { signOut } from "next-auth/react"

type Room = {
  id: string
  roomName: string
  title: string
  description: string | null
  status: string
  recordings: Recording[]
}

type Recording = {
  id: string
  filename: string
  s3Key: string
  duration: number | null
  createdAt: string
}

function formatDuration(seconds: number | null) {
  if (!seconds) return ""
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export default function StudentClient({
  user,
}: {
  user: { name?: string | null; email?: string | null }
}) {
  const [rooms, setRooms]               = useState<Room[]>([])
  const [loading, setLoading]           = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [playingKey, setPlayingKey]     = useState<string | null>(null)
  const [joining, setJoining]           = useState(false)

  useEffect(() => {
    fetch("/api/rooms")
      .then(r => r.json())
      .then(d => { setRooms(d.rooms ?? []); setLoading(false) })
  }, [])

  const joinSession = async (room: Room, suffix = "") => {
    setJoining(true)
    const baseName = user.name ?? user.email ?? "spectateur"
    const identity = suffix ? `${baseName} (${suffix})` : baseName

    const res = await fetch("/api/join_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_name: room.roomName, identity }),
    })

    if (!res.ok) {
      const msg = await res.text()
      if (msg.includes("already exists") || msg.includes("Participant already")) {
        setJoining(false)
        const choice = window.prompt(
          `Le nom "${identity}" est déjà utilisé dans cette salle.\n\nEntrez un suffixe pour vous différencier (ex: 2, 3, Bis…) :`,
          "2"
        )
        if (choice) {
          joinSession(room, choice.trim())
        }
        return
      }
      alert("Erreur lors de la connexion")
      setJoining(false)
      return
    }

    const data = await res.json()
    window.location.href = `/watch/${room.roomName}?token=${data.connection_details.token}`
    setJoining(false)
  }

  return (
    <div className="st-root">
      {/* HEADER */}
      <header className="st-header">
        <a href="/" className="st-logo-link">
          <Image src="/logo-unchk.png" alt="UN-CHK" width={110} height={44}
            style={{ objectFit: "contain" }} priority />
        </a>
        <div className="st-header-right">
          <span className="st-username">{user.name ?? user.email}</span>
          <button className="st-btn st-btn-outline"
            onClick={() => signOut({ callbackUrl: "/" })}>
            Déconnexion
          </button>
        </div>
      </header>

      <div className="st-layout">
        {/* LISTE SALLES */}
        <div className="st-sidebar">
          <div className="st-sidebar-header">
            <span className="st-sidebar-title">Mes salles</span>
            <span className="st-count">{rooms.length}</span>
          </div>
          {loading ? (
            <div className="st-loading"><span className="st-spinner" /> Chargement…</div>
          ) : rooms.length === 0 ? (
            <div className="st-empty">
              <p>Aucune salle assignée.</p>
              <p style={{ marginTop: 6, fontSize: "0.78rem" }}>
                Contactez votre modérateur.
              </p>
            </div>
          ) : rooms.map(room => (
            <div
              key={room.id}
              className={`st-room-item${selectedRoom?.id === room.id ? " active" : ""}`}
              onClick={() => { setSelectedRoom(room); setPlayingKey(null) }}
            >
              <div className="st-room-title">{room.title}</div>
              <div className="st-room-meta">
                {room.status === "LIVE" && <span className="st-live">● LIVE</span>}
                <span>{room.recordings.length} enreg.</span>
              </div>
            </div>
          ))}
        </div>

        {/* CONTENU */}
        <div className="st-main">
          {!selectedRoom ? (
            <div className="st-placeholder">
              <div style={{ fontSize: "2.5rem" }}>🏠</div>
              <p>Sélectionnez une salle</p>
            </div>
          ) : (
            <div className="st-card">
              {/* En-tête salle */}
              <div className="st-card-header">
                <div>
                  <h1 className="st-card-title">{selectedRoom.title}</h1>
                  {selectedRoom.description && (
                    <p className="st-card-desc">{selectedRoom.description}</p>
                  )}
                </div>
                <button
                  className="st-btn st-btn-primary"
                  disabled={joining}
                  onClick={() => joinSession(selectedRoom)}
                >
                  {joining ? "Connexion…" : "Rejoindre la session"}
                </button>
              </div>

              {/* Enregistrements */}
              <div className="st-rec-header">
                <span className="st-rec-title">Enregistrements</span>
                {selectedRoom.recordings.length > 0 && (
                  <span className="st-count">{selectedRoom.recordings.length}</span>
                )}
              </div>

              {selectedRoom.recordings.length === 0 ? (
                <div className="st-empty" style={{ padding: "32px 24px" }}>
                  Aucun enregistrement disponible
                </div>
              ) : selectedRoom.recordings.map(rec => (
                <div key={rec.id} className="st-rec-item">
                  <div className="st-rec-row">
                    <svg className="st-rec-icon" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
                    </svg>
                    <div className="st-rec-info">
                      <span className="st-rec-name">{rec.filename}</span>
                      <div className="st-rec-meta">
                        {rec.duration && <span>⏱ {formatDuration(rec.duration)}</span>}
                        <span>
                          {new Date(rec.createdAt).toLocaleString("fr-FR", {
                            dateStyle: "short", timeStyle: "short"
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="st-rec-actions">
                      <button
                        className="st-btn st-btn-primary"
                        onClick={() => setPlayingKey(
                          playingKey === rec.s3Key ? null : rec.s3Key
                        )}
                      >
                        {playingKey === rec.s3Key ? "Fermer" : "Voir"}
                      </button>
                      <a
                        href={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}
                        className="st-btn st-btn-green"
                        target="_blank" rel="noopener noreferrer"
                      >
                        Télécharger
                      </a>
                    </div>
                  </div>
                  {playingKey === rec.s3Key && (
                    <div className="st-rec-player">
                      <video controls autoPlay
                        src={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}>
                        Votre navigateur ne supporte pas la lecture vidéo.
                      </video>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="st-footer">
        <p>Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation</p>
        <p className="st-footer-strong">Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
        <p className="st-footer-copy">© DITSI – UN-CHK – 2026 – Tous droits réservés</p>
      </footer>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        .st-root{min-height:100vh;display:flex;flex-direction:column;background:#f0f4ff;font-family:'Google Sans','Segoe UI',system-ui,sans-serif;color:#1a1a2e;}
        .st-header{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:64px;background:#fff;border-bottom:1px solid #e2e8f0;}
        .st-logo-link{display:flex;align-items:center;}
        .st-header-right{display:flex;align-items:center;gap:12px;}
        .st-username{font-size:0.88rem;color:#374151;font-weight:500;}
        .st-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 16px;border-radius:8px;font-size:0.83rem;font-weight:600;font-family:inherit;cursor:pointer;text-decoration:none;border:none;white-space:nowrap;transition:filter .15s;}
        .st-btn:hover:not(:disabled){filter:brightness(.92);}
        .st-btn:disabled{opacity:.5;cursor:not-allowed;}
        .st-btn-outline{background:#fff;border:1.5px solid #0065b1;color:#0065b1;}
        .st-btn-primary{background:#0065b1;color:#fff;}
        .st-btn-green{background:#fff;border:1.5px solid #16a34a;color:#16a34a;}
        .st-layout{display:flex;flex:1;max-width:1140px;margin:0 auto;width:100%;padding:24px 32px 40px;gap:20px;}
        .st-sidebar{width:280px;flex-shrink:0;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;align-self:start;}
        .st-sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f0f7ff;}
        .st-sidebar-title{font-size:0.95rem;font-weight:700;}
        .st-count{background:#e8f4ff;color:#0065b1;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px;}
        .st-loading{display:flex;align-items:center;gap:8px;padding:24px 18px;color:#9ca3af;font-size:0.85rem;}
        .st-spinner{width:14px;height:14px;border:2px solid #e2e8f0;border-top-color:#0065b1;border-radius:50%;animation:st-spin .7s linear infinite;display:inline-block;}
        @keyframes st-spin{to{transform:rotate(360deg)}}
        .st-empty{padding:24px 18px;color:#9ca3af;font-size:0.85rem;text-align:center;}
        .st-room-item{padding:12px 18px;cursor:pointer;border-bottom:1px solid #f0f7ff;transition:background .12s;border-left:3px solid transparent;}
        .st-room-item:last-child{border-bottom:none;}
        .st-room-item:hover{background:#f8fbff;}
        .st-room-item.active{background:#e8f4ff;border-left-color:#0065b1;}
        .st-room-title{font-size:0.88rem;font-weight:600;color:#1a1a2e;}
        .st-room-meta{display:flex;align-items:center;gap:8px;margin-top:3px;font-size:0.75rem;color:#9ca3af;}
        .st-live{color:#16a34a;font-weight:700;}
        .st-main{flex:1;min-width:0;}
        .st-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;height:300px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;gap:12px;color:#9ca3af;}
        .st-card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;}
        .st-card-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #f0f7ff;gap:16px;}
        .st-card-title{font-size:1.1rem;font-weight:700;color:#1a1a2e;}
        .st-card-desc{font-size:0.82rem;color:#64748b;margin-top:4px;}
        .st-rec-header{display:flex;align-items:center;gap:10px;padding:12px 24px;background:#f8fbff;border-bottom:1px solid #f0f7ff;}
        .st-rec-title{font-size:0.88rem;font-weight:700;}
        .st-rec-item{border-bottom:1px solid #f0f7ff;}
        .st-rec-item:last-child{border-bottom:none;}
        .st-rec-row{display:flex;align-items:center;gap:12px;padding:14px 20px;}
        .st-rec-icon{width:26px;height:26px;color:#0065b1;flex-shrink:0;}
        .st-rec-info{flex:1;min-width:0;}
        .st-rec-name{font-size:0.85rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;}
        .st-rec-meta{display:flex;gap:12px;margin-top:3px;flex-wrap:wrap;}
        .st-rec-meta span{font-size:0.73rem;color:#9ca3af;}
        .st-rec-actions{display:flex;gap:8px;flex-shrink:0;}
        .st-rec-player{padding:0 20px 16px;}
        .st-rec-player video{width:100%;max-height:380px;border-radius:8px;background:#000;display:block;}
        .st-footer{background:#fff;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;display:flex;flex-direction:column;gap:3px;margin-top:auto;}
        .st-footer p{font-size:0.78rem;color:#6b7280;}
        .st-footer-strong{font-size:0.88rem;font-weight:700;color:#0065b1!important;}
        .st-footer-copy{font-size:0.72rem;color:#9ca3af!important;}
        @media(max-width:768px){.st-layout{flex-direction:column;padding:16px;}.st-sidebar{width:100%;}}
      `}</style>
    </div>
  )
}
