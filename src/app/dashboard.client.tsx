"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { signOut } from "next-auth/react"

type Room = {
  id: string
  roomName: string
  title: string
  description: string | null
  status: string
  chatEnabled: boolean
  participationEnabled: boolean
  createdAt: string
  updatedAt: string
  recordings: Recording[]
}

type Recording = {
  id: string
  filename: string
  s3Key: string
  duration: number | null
  createdAt: string
}

type User = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  role: string
}

export default function DashboardClient({ user }: { user: User }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState<Record<string, "recordings" | "settings">>({})
  const [deleting, setDeleting] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    const res = await fetch("/api/rooms")
    const data = await res.json()
    setRooms(data.rooms ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  const startMeeting = async (room: Room) => {
    const res = await fetch("/api/create_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_name: room.roomName,
        metadata: {
          creator_identity: user.name ?? user.email ?? "Animateur",
          enable_chat: room.chatEnabled,
          allow_participation: room.participationEnabled,
        },
      }),
    })
    if (!res.ok) { alert("Erreur démarrage"); return }
    const data = await res.json()
    window.location.href = `/host?at=${data.auth_token}&rt=${data.connection_details.token}`
  }

  const deleteRoom = async (id: string) => {
    if (!confirm("Supprimer cette salle ?")) return
    setDeleting(id)
    await fetch(`/api/rooms/${id}`, { method: "DELETE" })
    await fetchRooms()
    setDeleting(null)
  }

  const copyLink = (roomName: string) => {
    const url = `${window.location.origin}/watch/${roomName}`
    navigator.clipboard.writeText(url)
    alert("Lien copié !")
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return ""
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const tab = (id: string) => activeTab[id] ?? "recordings"
  const setTab = (id: string, t: "recordings" | "settings") =>
    setActiveTab(prev => ({ ...prev, [id]: t }))

  return (
    <div className="gl-root">
      <header className="gl-header">
        <a href="/" className="gl-logo">
          <Image src="/logo-unchk.png" alt="UN-CHK" width={110} height={44}
            style={{ objectFit: "contain" }} priority />
        </a>
        <div className="gl-header-right">
          <span className="gl-user-badge">{user.role}</span>
          <span className="gl-user-name">{user.name ?? user.email}</span>
          {(user.role === "ADMIN" || user.role === "MODERATOR") && (
            <a href="/admin" className="gl-btn-admin">Admin</a>
          )}
          <button className="gl-btn-outline" onClick={() => signOut({ callbackUrl: "/" })}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="gl-main">
        <div className="gl-top">
          <div>
            <h1 className="gl-title">Mes salles</h1>
            <p className="gl-subtitle">{rooms.length} salle{rooms.length !== 1 ? "s" : ""}</p>
          </div>
          {user.role !== "VIEWER" && (
            <button className="gl-btn-primary" onClick={() => setShowCreate(true)}>
              + Créer une salle
            </button>
          )}
        </div>

        {loading ? (
          <div className="gl-loading"><span className="gl-spinner" />Chargement...</div>
        ) : rooms.length === 0 ? (
          <div className="gl-empty">
            <div className="gl-empty-icon">🏠</div>
            <p>Vous n&apos;avez pas encore de salle</p>
            {user.role !== "VIEWER" && (
              <button className="gl-btn-primary" onClick={() => setShowCreate(true)}>
                Créer votre première salle
              </button>
            )}
          </div>
        ) : (
          <div className="gl-rooms">
            {rooms.map(room => (
              <div key={room.id} className="gl-room-card">
                <div className="gl-room-header">
                  <div className="gl-room-info">
                    <h2 className="gl-room-title">{room.title}</h2>
                    {room.description && (
                      <p className="gl-room-desc">{room.description}</p>
                    )}
                    <p className="gl-room-date">
                      Dernière activité : {new Date(room.updatedAt).toLocaleString("fr-FR", {
                        dateStyle: "medium", timeStyle: "short"
                      })}
                    </p>
                  </div>
                  <div className="gl-room-actions">
                    <button className="gl-btn-copy" onClick={() => copyLink(room.roomName)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      Copier le lien
                    </button>
                    <button className="gl-btn-start" onClick={() => startMeeting(room)}>
                      Commencer la réunion
                    </button>
                  </div>
                </div>

                <div className="gl-tabs">
                  <button
                    className={`gl-tab ${tab(room.id) === "recordings" ? "active" : ""}`}
                    onClick={() => setTab(room.id, "recordings")}
                  >
                    Enregistrements
                    {room.recordings.length > 0 && (
                      <span className="gl-tab-badge">{room.recordings.length}</span>
                    )}
                  </button>
                  <button
                    className={`gl-tab ${tab(room.id) === "settings" ? "active" : ""}`}
                    onClick={() => setTab(room.id, "settings")}
                  >
                    Paramètres
                  </button>
                </div>

                <div className="gl-tab-content">
                  {tab(room.id) === "recordings" && (
                    <div className="gl-recordings">
                      {room.recordings.length === 0 ? (
                        <p className="gl-no-rec">Aucun enregistrement disponible</p>
                      ) : (
                        room.recordings.map(rec => (
                          <div key={rec.id} className="gl-rec-block">
                            <div className="gl-rec-row">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polygon points="10,8 16,12 10,16" fill="currentColor"/>
                              </svg>
                              <span className="gl-rec-name">{rec.filename}</span>
                              {rec.duration && (
                                <span className="gl-rec-duration">
                                  {formatDuration(rec.duration)}
                                </span>
                              )}
                              <span className="gl-rec-date">
                                {new Date(rec.createdAt).toLocaleString("fr-FR", {
                                  dateStyle: "short", timeStyle: "short"
                                })}
                              </span>
                              <div className="gl-rec-btns">
                                <button
                                  className="gl-rec-btn-play"
                                  onClick={() => setPlayingKey(
                                    playingKey === rec.s3Key ? null : rec.s3Key
                                  )}
                                >
                                  {playingKey === rec.s3Key ? "Fermer" : "Voir"}
                                </button>
                                <a
                                  href={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}
                                  className="gl-rec-btn-dl"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Télécharger
                                </a>
                              </div>
                            </div>
                            {playingKey === rec.s3Key && (
                              <div className="gl-rec-player">
                                <video
                                  controls
                                  autoPlay
                                  style={{ width: "100%", maxHeight: "400px",
                                    borderRadius: "8px", background: "#000" }}
                                  src={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}
                                >
                                  Votre navigateur ne supporte pas la lecture vidéo.
                                </video>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {tab(room.id) === "settings" && (
                    <div className="gl-settings">
                      <div className="gl-setting-row">
                        <span>Identifiant de la salle</span>
                        <code className="gl-room-slug">{room.roomName}</code>
                      </div>
                      <div className="gl-setting-row">
                        <span>Lien spectateur</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <code className="gl-room-slug" style={{ fontSize: "0.72rem" }}>
                            /watch/{room.roomName}
                          </code>
                          <button className="gl-btn-copy-sm"
                            onClick={() => copyLink(room.roomName)}>
                            Copier
                          </button>
                        </div>
                      </div>
                      <div className="gl-setting-row">
                        <span>Chat activé</span>
                        <span className={`gl-badge ${room.chatEnabled ? "on" : "off"}`}>
                          {room.chatEnabled ? "Oui" : "Non"}
                        </span>
                      </div>
                      <div className="gl-setting-row">
                        <span>Participation</span>
                        <span className={`gl-badge ${room.participationEnabled ? "on" : "off"}`}>
                          {room.participationEnabled ? "Activée" : "Désactivée"}
                        </span>
                      </div>
                      <div className="gl-setting-row">
                        <span>Statut</span>
                        <span className={`gl-badge ${room.status === "LIVE" ? "on" : "off"}`}>
                          {room.status === "LIVE" ? "En direct" :
                           room.status === "ENDED" ? "Terminée" : "Programmée"}
                        </span>
                      </div>
                      {user.role !== "VIEWER" && (
                        <button
                          className="gl-btn-delete"
                          onClick={() => deleteRoom(room.id)}
                          disabled={deleting === room.id}
                        >
                          {deleting === room.id ? "Suppression..." : "Supprimer la salle"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="gl-footer">
        <p>Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation</p>
        <p className="gl-footer-strong">Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
        <p className="gl-footer-copy">© DITSI – UN-CHK – 2026 – Tous droits réservés</p>
      </footer>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { fetchRooms(); setShowCreate(false) }}
        />
      )}

      <style>{`
        .gl-root{min-height:100vh;display:flex;flex-direction:column;background:#f5f8ff;font-family:'Google Sans','Segoe UI',system-ui,sans-serif;color:#1a1a2e;}
        .gl-header{display:flex;align-items:center;justify-content:space-between;padding:12px 48px;background:white;border-bottom:1px solid #e2e8f0;box-shadow:0 1px 4px rgba(0,0,0,.06);}
        .gl-header-right{display:flex;align-items:center;gap:12px;}
        .gl-user-name{font-size:0.88rem;color:#5f6368;font-weight:500;}
        .gl-user-badge{font-size:0.7rem;font-weight:700;padding:2px 8px;border-radius:10px;background:#e8f0fe;color:#0065b1;text-transform:uppercase;}
        .gl-logo{display:flex;align-items:center;}
        .gl-btn-outline{padding:7px 16px;border:1.5px solid #0065b1;border-radius:8px;background:white;color:#0065b1;font-size:0.82rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .gl-btn-outline:hover{background:#e8f0fe;}
        .gl-btn-admin{padding:7px 14px;background:#f1f5f9;border:1.5px solid #e2e8f0;border-radius:8px;color:#475569;font-size:0.82rem;font-weight:500;text-decoration:none;}
        .gl-btn-admin:hover{background:#e2e8f0;}
        .gl-main{max-width:960px;margin:0 auto;padding:40px 24px;flex:1;width:100%;}
        .gl-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;}
        .gl-title{font-size:1.8rem;font-weight:700;color:#1a1a2e;}
        .gl-subtitle{font-size:0.88rem;color:#94a3b8;margin-top:4px;}
        .gl-btn-primary{padding:10px 22px;background:#0065b1;color:white;border:none;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;}
        .gl-btn-primary:hover{background:#004d8c;}
        .gl-loading{display:flex;align-items:center;gap:12px;color:#94a3b8;padding:48px 0;}
        .gl-spinner{width:20px;height:20px;border:2px solid #e2e8f0;border-top-color:#0065b1;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .gl-empty{display:flex;flex-direction:column;align-items:center;gap:16px;padding:80px 0;color:#94a3b8;}
        .gl-empty-icon{font-size:3rem;}
        .gl-empty p{font-size:1rem;font-weight:500;}
        .gl-rooms{display:flex;flex-direction:column;gap:20px;}
        .gl-room-card{background:white;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,.05);overflow:hidden;}
        .gl-room-header{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #f1f5f9;gap:16px;}
        .gl-room-info{flex:1;}
        .gl-room-title{font-size:1.1rem;font-weight:700;color:#1a1a2e;}
        .gl-room-desc{font-size:0.82rem;color:#64748b;margin-top:4px;}
        .gl-room-date{font-size:0.75rem;color:#94a3b8;margin-top:6px;}
        .gl-room-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;}
        .gl-btn-copy{display:flex;align-items:center;gap:6px;padding:8px 14px;background:white;border:1.5px solid #e2e8f0;border-radius:8px;font-size:0.82rem;color:#5f6368;cursor:pointer;font-family:inherit;}
        .gl-btn-copy:hover{border-color:#0065b1;color:#0065b1;}
        .gl-btn-copy-sm{padding:3px 10px;background:white;border:1px solid #e2e8f0;border-radius:5px;font-size:0.75rem;color:#5f6368;cursor:pointer;font-family:inherit;}
        .gl-btn-start{padding:10px 20px;background:#0065b1;color:white;border:none;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;}
        .gl-btn-start:hover{background:#004d8c;}
        .gl-tabs{display:flex;border-bottom:1px solid #f1f5f9;padding:0 24px;}
        .gl-tab{padding:12px 16px;background:none;border:none;font-size:0.85rem;font-weight:500;color:#94a3b8;cursor:pointer;font-family:inherit;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;align-items:center;gap:6px;}
        .gl-tab.active{color:#0065b1;border-bottom-color:#0065b1;}
        .gl-tab-badge{background:#0065b1;color:white;border-radius:10px;padding:1px 6px;font-size:0.68rem;font-weight:700;}
        .gl-tab-content{padding:16px 24px;}
        .gl-recordings{display:flex;flex-direction:column;gap:8px;}
        .gl-no-rec{font-size:0.85rem;color:#94a3b8;padding:8px 0;}
        .gl-rec-block{border:1px solid #f1f5f9;border-radius:10px;overflow:hidden;}
        .gl-rec-row{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f8fafc;font-size:0.82rem;}
        .gl-rec-name{flex:1;color:#1a1a2e;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .gl-rec-duration{color:#0065b1;font-size:0.78rem;flex-shrink:0;}
        .gl-rec-date{color:#94a3b8;flex-shrink:0;}
        .gl-rec-btns{display:flex;gap:6px;flex-shrink:0;}
        .gl-rec-btn-play{padding:5px 12px;background:#0065b1;color:white;border:none;border-radius:6px;font-size:0.78rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .gl-rec-btn-play:hover{background:#004d8c;}
        .gl-rec-btn-dl{padding:5px 12px;background:white;color:#1e7e34;border:1px solid rgba(30,126,52,.3);border-radius:6px;font-size:0.78rem;font-weight:500;text-decoration:none;}
        .gl-rec-btn-dl:hover{background:#e8f5e9;}
        .gl-rec-player{padding:12px;background:#000;}
        .gl-settings{display:flex;flex-direction:column;gap:12px;}
        .gl-setting-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:0.88rem;color:#5f6368;}
        .gl-room-slug{background:#f1f5f9;padding:3px 8px;border-radius:5px;font-size:0.8rem;color:#1a1a2e;}
        .gl-badge{padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;}
        .gl-badge.on{background:#dcfce7;color:#16a34a;}
        .gl-badge.off{background:#f1f5f9;color:#94a3b8;}
        .gl-btn-delete{margin-top:8px;padding:8px 16px;background:white;border:1.5px solid #ef4444;color:#ef4444;border-radius:8px;font-size:0.82rem;font-weight:500;cursor:pointer;font-family:inherit;}
        .gl-btn-delete:hover:not(:disabled){background:#ef4444;color:white;}
        .gl-btn-delete:disabled{opacity:.5;cursor:not-allowed;}
        .gl-footer{background:white;border-top:2px solid rgba(0,101,177,0.12);padding:20px 48px;text-align:center;display:flex;flex-direction:column;gap:3px;}
        .gl-footer p{font-size:0.78rem;color:#5f6368;margin:0;}
        .gl-footer-strong{font-size:0.88rem !important;font-weight:700;color:#0065b1 !important;}
        .gl-footer-copy{font-size:0.72rem !important;color:#9aa0a6 !important;}
      `}</style>
    </div>
  )
}

function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: "", description: "", chatEnabled: true, participationEnabled: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Le titre est requis"); return }
    setLoading(true)
    setError("")
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!res.ok) { setError("Erreur création salle"); setLoading(false); return }
    onCreated()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Créer une nouvelle salle</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-field">
            <label>Nom de la salle *</label>
            <input type="text" placeholder="ex: Introduction au Machine Learning"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              autoFocus />
          </div>
          <div className="modal-field">
            <label>Description (optionnelle)</label>
            <input type="text" placeholder="Description de la salle"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="modal-toggle"
            onClick={() => setForm({ ...form, chatEnabled: !form.chatEnabled })}>
            <span>Activer le chat</span>
            <div className={`toggle ${form.chatEnabled ? "on" : ""}`}>
              <div className="thumb"/>
            </div>
          </div>
          <div className="modal-toggle"
            onClick={() => setForm({ ...form, participationEnabled: !form.participationEnabled })}>
            <span>Autoriser la participation</span>
            <div className={`toggle ${form.participationEnabled ? "on" : ""}`}>
              <div className="thumb"/>
            </div>
          </div>
          {error && <p className="modal-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="modal-btn-cancel" onClick={onClose}>Annuler</button>
          <button className="modal-btn-create" onClick={handleSubmit} disabled={loading}>
            {loading ? "Création..." : "Créer la salle"}
          </button>
        </div>
      </div>
      <style>{`
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:100;}
        .modal{background:white;border-radius:16px;width:100%;max-width:480px;box-shadow:0 24px 64px rgba(0,0,0,.2);}
        .modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e2e8f0;}
        .modal-header h2{font-size:1.05rem;font-weight:700;color:#1a1a2e;}
        .modal-close{background:none;border:none;font-size:1rem;cursor:pointer;color:#94a3b8;width:32px;height:32px;border-radius:50%;}
        .modal-close:hover{background:#f1f5f9;}
        .modal-body{padding:20px 24px;display:flex;flex-direction:column;gap:14px;}
        .modal-field{display:flex;flex-direction:column;gap:5px;}
        .modal-field label{font-size:0.82rem;font-weight:600;color:#5f6368;}
        .modal-field input{padding:10px 13px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:0.9rem;outline:none;font-family:inherit;}
        .modal-field input:focus{border-color:#0065b1;}
        .modal-toggle{display:flex;align-items:center;justify-content:space-between;padding:12px;border:1.5px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:0.88rem;color:#1a1a2e;}
        .modal-toggle:hover{background:#f8fafc;}
        .toggle{width:42px;height:22px;border-radius:11px;background:#e2e8f0;position:relative;transition:background .2s;}
        .toggle.on{background:#0065b1;}
        .thumb{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:white;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
        .toggle.on .thumb{transform:translateX(20px);}
        .modal-error{color:#ef4444;font-size:0.82rem;}
        .modal-footer{padding:16px 24px;display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #e2e8f0;}
        .modal-btn-cancel{padding:9px 18px;border:1.5px solid #e2e8f0;border-radius:8px;background:white;color:#5f6368;font-size:0.88rem;cursor:pointer;font-family:inherit;}
        .modal-btn-create{padding:9px 20px;background:#0065b1;color:white;border:none;border-radius:8px;font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;}
        .modal-btn-create:disabled{opacity:.5;cursor:not-allowed;}
      `}</style>
    </div>
  )
}
