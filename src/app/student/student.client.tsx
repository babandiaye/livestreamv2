"use client"

import { useState, useEffect } from "react"
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
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}m` : `${m}:${s.toString().padStart(2, "0")}`
}

function initials(name: string) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

export default function StudentClient({
  user,
}: {
  user: { name?: string | null; email?: string | null }
}) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

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
          `Le nom "${identity}" est déjà utilisé.\nEntrez un suffixe (ex: 2, 3…) :`,
          "2"
        )
        if (choice) joinSession(room, choice.trim())
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

  const userName = user.name ?? user.email ?? "Étudiant"
  const liveRooms = rooms.filter(r => r.status === "LIVE")

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Google Sans','Segoe UI',system-ui,sans-serif", color: "#1a1a2e", background: "#f8fafd", position: "relative" }}>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 40 }} />
      )}
      {/* ── SIDEBAR ── */}
      <div style={{ width: 210, flexShrink: 0, background: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50, transition: "transform .25s ease" }} className={`st-sidebar-mobile${sidebarOpen ? " open" : ""}`}>
        {/* Logo */}
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "#0065b1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.259a1 1 0 01-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e" }}>UN-CHK</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Webinaire</div>
          </div>
        </div>

        {/* Liste des salles */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ padding: "10px 8px 4px" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", padding: "4px 8px 6px", textTransform: "uppercase", letterSpacing: ".05em" }}>
              Mes webinaires
              {rooms.length > 0 && <span style={{ background: "#f0f7ff", color: "#0065b1", fontSize: 10, padding: "1px 5px", borderRadius: 10, fontWeight: 600, marginLeft: 6 }}>{rooms.length}</span>}
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 14px", color: "#9ca3af", fontSize: 13 }}>
              <span style={{ width: 13, height: 13, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "st-spin .7s linear infinite", display: "inline-block" }} />Chargement…
            </div>
          ) : rooms.length === 0 ? (
            <div style={{ padding: "16px 14px", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
              Aucune salle assignée
            </div>
          ) : (
            <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {rooms.map(room => (
                <button key={room.id}
                  onClick={() => { setSelectedRoom(room); setPlayingKey(null) }}
                  style={{ display: "flex", flexDirection: "column", padding: "8px 10px", borderRadius: 8, border: "none", background: selectedRoom?.id === room.id ? "#e8f4ff" : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%", borderLeft: `3px solid ${selectedRoom?.id === room.id ? "#0065b1" : "transparent"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, width: "100%" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: selectedRoom?.id === room.id ? "#0065b1" : "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{room.title}</span>
                    {room.status === "LIVE" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />}
                  </div>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                    {room.status === "LIVE"
                      ? <span style={{ color: "#22c55e", fontWeight: 600 }}>En direct</span>
                      : room.status === "ENDED"
                        ? `${room.recordings.length} enreg.`
                        : "Planifiée"
                    }
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Profil */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid #f0f7ff", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e8f4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#0065b1", flexShrink: 0 }}>
            {initials(userName)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Spectateur</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/" })} title="Déconnexion"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#e53e3e", padding: 4, borderRadius: 5, display: "flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", marginLeft: "210px" }} className="st-main-content">

        {/* Header */}
        <div style={{ padding: "0 16px", height: 60, background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(true)} className="st-hamburger" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, display: "none", marginRight: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>
              {selectedRoom ? selectedRoom.title : "Mes webinaires"}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {selectedRoom ? "Détails de la session" : "Sélectionnez une salle"}
            </div>
          </div>
          {liveRooms.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#dcfce7", color: "#166534", fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              {liveRooms.length} session{liveRooms.length > 1 ? "s" : ""} en direct
            </div>
          )}
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

          {!selectedRoom ? (
            /* Placeholder — aucune salle sélectionnée */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: 14, color: "#9ca3af" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.259a1 1 0 01-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>
              <p style={{ fontSize: 15 }}>Sélectionnez une salle dans le menu</p>
              {rooms.length === 0 && !loading && (
                <p style={{ fontSize: 13, color: "#c4cdd9" }}>Contactez votre modérateur pour être enrôlé</p>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Card principale de la salle */}
              <div style={{ background: "white", border: `2px solid ${selectedRoom.status === "LIVE" ? "#22c55e" : "#e2e8f0"}`, borderRadius: 12, overflow: "hidden" }}>

                {/* Banner LIVE */}
                {selectedRoom.status === "LIVE" && (
                  <div style={{ background: "#f0fdf4", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #bbf7d0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>Session en direct</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#166534" }}>Rejoignez maintenant !</span>
                  </div>
                )}

                {/* Infos salle */}
                <div style={{ padding: "20px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "#1a1a2e", marginBottom: 6 }}>{selectedRoom.title}</div>
                    {selectedRoom.description && (
                      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>{selectedRoom.description}</div>
                    )}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>Statut :</span>
                        <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: selectedRoom.status === "LIVE" ? "#dcfce7" : "#f1f5f9", color: selectedRoom.status === "LIVE" ? "#166534" : "#6b7280" }}>
                          {selectedRoom.status === "LIVE" ? "● En direct" : selectedRoom.status === "ENDED" ? "Terminée" : "Planifiée"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>Enregistrements :</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: selectedRoom.recordings.length > 0 ? "#0065b1" : "#9ca3af" }}>
                          {selectedRoom.recordings.length > 0 ? `${selectedRoom.recordings.length} disponible${selectedRoom.recordings.length > 1 ? "s" : ""}` : "Aucun"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button disabled={joining} onClick={() => joinSession(selectedRoom)}
                    style={{ padding: "10px 28px", background: selectedRoom.status === "LIVE" ? "#22c55e" : "#0065b1", color: "white", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: joining ? .5 : 1, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {joining ? "Connexion…" : selectedRoom.status === "LIVE" ? "Rejoindre →" : "Rejoindre"}
                  </button>
                </div>
              </div>

              {/* Enregistrements de cette salle */}
              {selectedRoom.recordings.length > 0 && (
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0065b1" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Enregistrements</span>
                    <span style={{ background: "#e8f4ff", color: "#0065b1", fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{selectedRoom.recordings.length}</span>
                  </div>
                  {selectedRoom.recordings.map(rec => (
                    <div key={rec.id} style={{ borderBottom: "1px solid #f0f7ff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: "#e8f4ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0065b1" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.filename}</div>
                          <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                            {rec.duration && <span style={{ fontSize: 13, color: "#9ca3af" }}>⏱ {formatDuration(rec.duration)}</span>}
                            <span style={{ fontSize: 13, color: "#9ca3af" }}>{new Date(rec.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => setPlayingKey(playingKey === rec.s3Key ? null : rec.s3Key)}
                            style={{ padding: "6px 14px", background: "#0065b1", color: "white", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                            {playingKey === rec.s3Key ? "✖ Fermer" : "▶ Voir"}
                          </button>
                          <a href={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`} target="_blank" rel="noopener noreferrer"
                            style={{ padding: "6px 14px", background: "white", color: "#2fb344", border: "1px solid #2fb344", borderRadius: 7, fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>⬇ Télécharger</a>
                        </div>
                      </div>
                      {playingKey === rec.s3Key && (
                        <div style={{ padding: "0 20px 16px" }}>
                          <video controls autoPlay src={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}
                            style={{ width: "100%", maxHeight: 420, borderRadius: 10, background: "#000", display: "block" }}>
                            Votre navigateur ne supporte pas la lecture vidéo.
                          </video>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedRoom.recordings.length === 0 && (
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                  Aucun enregistrement disponible pour cette session
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: "white", borderTop: "1px solid #e2e8f0", padding: "10px 24px", textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontSize: 13, color: "#6b7280" }}>Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#0065b1" }}>Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>© DITSI – UN-CHK – 2026</p>
        </div>
      </div>

      <style>{`
        @keyframes st-spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f8fafd; }
        ::-webkit-scrollbar-thumb { background: #d1e4f5; border-radius: 3px; }
        @media (max-width: 768px) {
          .st-sidebar-mobile { transform: translateX(-100%); }
          .st-sidebar-mobile.open { transform: translateX(0); }
          .st-hamburger { display: flex !important; }
          .st-main-content { margin-left: 0 !important; }
        }
        @media (min-width: 769px) {
          .st-sidebar-mobile { transform: translateX(0) !important; position: relative !important; }
          .st-main-content { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  )
}
