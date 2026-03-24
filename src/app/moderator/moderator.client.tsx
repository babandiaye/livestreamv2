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
  recordings: number
  enrollments: number
}

type Recording = {
  id: string
  filename: string
  s3Key: string
  duration: number | null
  size: number | null
  createdAt: string
  session: { id: string; title: string; roomName: string; creator: { name: string; email: string } }
}

type EnrolledUser = { id: string; name: string; email: string; role: string; enrolledAt: string }
type SearchUser = { id: string; name: string; email: string; role: string }
type ImportResult = { summary: { total: number; created: number; enrolled: number; skipped: number }; skipped: string[] }

type User = {
  id: string
  name?: string | null
  email?: string | null
  role: string
}

function formatDuration(seconds: number | null) {
  if (!seconds) return ""
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}m` : `${m}:${s.toString().padStart(2, "0")}`
}

function formatSize(b: number) {
  if (!b) return "—"
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  if (b < 1024 ** 3) return `${(b / (1024 * 1024)).toFixed(1)} Mo`
  return `${(b / 1024 ** 3).toFixed(2)} Go`
}

// ── EnrollPanel ──
function EnrollPanel({ sessionId, sessionTitle }: { sessionId: string; sessionTitle: string }) {
  const [subTab, setSubTab] = useState<"manual" | "csv">("manual")
  const [enrolled, setEnrolled] = useState<EnrolledUser[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvDrag, setCsvDrag] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  const fetchEnrolled = useCallback(async () => {
    setLoadingList(true)
    const d = await (await fetch(`/api/admin/rooms/${sessionId}/enroll`)).json()
    setEnrolled(d.enrollments ?? [])
    setLoadingList(false)
  }, [sessionId])

  useEffect(() => { fetchEnrolled() }, [fetchEnrolled])

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const d = await (await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`)).json()
      const ids = new Set(enrolled.map(e => e.id))
      setResults((d.users ?? []).filter((u: SearchUser) => !ids.has(u.id)))
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, enrolled])

  const enroll = async (userId: string) => {
    setAdding(userId)
    await fetch(`/api/admin/rooms/${sessionId}/enroll`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    setQuery(""); setResults([])
    await fetchEnrolled(); setAdding(null)
  }

  const unenroll = async (userId: string) => {
    setRemoving(userId)
    await fetch(`/api/admin/rooms/${sessionId}/enroll`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    await fetchEnrolled(); setRemoving(null)
  }

  const submitCsv = async () => {
    if (!csvFile) return
    setCsvLoading(true); setCsvError(null); setCsvResult(null)
    const fd = new FormData(); fd.append("file", csvFile)
    try {
      const res = await fetch(`/api/admin/rooms/${sessionId}/enroll-csv`, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) setCsvError(data.error ?? "Erreur import")
      else { setCsvResult(data); if (data.summary.enrolled > 0) fetchEnrolled() }
    } catch { setCsvError("Erreur réseau") }
    setCsvLoading(false)
  }

  return (
    <div className="ep-root">
      <div className="ep-header">
        <span className="ep-title">{sessionTitle}</span>
        <div className="ep-tabs">
          <button className={`ep-tab${subTab === "manual" ? " active" : ""}`} onClick={() => setSubTab("manual")}>Individuel</button>
          <button className={`ep-tab${subTab === "csv" ? " active" : ""}`} onClick={() => setSubTab("csv")}>Import CSV</button>
        </div>
      </div>

      {subTab === "manual" && (
        <>
          <div className="ep-search">
            <input className="ep-input" placeholder="Rechercher un utilisateur…" value={query} onChange={e => setQuery(e.target.value)} />
            {searching && <span className="ep-spinner" />}
          </div>
          {results.length > 0 && (
            <div className="ep-results">
              {results.map(u => (
                <div key={u.id} className="ep-row">
                  <div className="ep-uinfo">
                    <span className="ep-uname">{u.name}</span>
                    <span className="ep-uemail">{u.email}</span>
                  </div>
                  <button className="mod-btn mod-btn-primary ep-sm" disabled={adding === u.id} onClick={() => enroll(u.id)}>
                    {adding === u.id ? "…" : "+ Ajouter"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {subTab === "csv" && !csvResult && (
        <div className="ep-csv">
          <div className="ep-csv-info-bar">
            <div className="ep-csv-info">
              Colonnes : <code>email</code> · <code>email,nom</code> · <code>email,prenom,nom</code> — séparateur <code>,</code> ou <code>;</code>
              <br />Supporte jusqu&apos;à <strong>10 000 utilisateurs</strong> par import. Les utilisateurs inexistants sont créés automatiquement.
            </div>
            <a href="/api/admin/enroll-csv-template" download className="ep-csv-dl">
              ⬇ Télécharger le modèle
            </a>
          </div>
          <div
            className={`ep-dropzone${csvDrag ? " drag" : ""}${csvFile ? " ok" : ""}`}
            onDragOver={e => { e.preventDefault(); setCsvDrag(true) }}
            onDragLeave={() => setCsvDrag(false)}
            onDrop={e => { e.preventDefault(); setCsvDrag(false); const f = e.dataTransfer.files[0]; if (f) setCsvFile(f) }}
            onClick={() => document.getElementById("csv-input-mod")?.click()}>
            <input id="csv-input-mod" type="file" accept=".csv" style={{ display: "none" }} onChange={e => e.target.files?.[0] && setCsvFile(e.target.files[0])} />
            {csvFile
              ? <span className="ep-fname">📄 {csvFile.name}</span>
              : (
                <div className="ep-dropzone-content">
                  <div className="ep-dropzone-icon">📂</div>
                  <span className="ep-hint">Glisser un fichier CSV ici ou cliquer pour sélectionner</span>
                  <span className="ep-hint-sub">Format accepté : .csv — séparateur , ou ;</span>
                </div>
              )
            }
          </div>
          {csvError && <div className="ep-csv-err">⚠️ {csvError}</div>}
          {csvLoading && (
            <div className="ep-progress-wrap">
              <div className="ep-progress-bar">
                <div className="ep-progress-fill" />
              </div>
              <span className="ep-progress-label">Import en cours, veuillez patienter…</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            {csvFile && !csvLoading && (
              <button className="mod-btn mod-btn-outline" onClick={() => setCsvFile(null)}>Annuler</button>
            )}
            <button className="mod-btn mod-btn-primary" onClick={submitCsv} disabled={!csvFile || csvLoading}>
              {csvLoading ? <><span className="ep-spinner" /> Import en cours…</> : "Importer"}
            </button>
          </div>
        </div>
      )}

      {subTab === "csv" && csvResult && (
        <div className="ep-csv">
          <div className="ep-csv-success-banner">
            ✅ Import terminé avec succès
          </div>
          <div className="ep-csv-stats">
            {[
              { v: csvResult.summary.total,    l: "lus",          c: "total" },
              { v: csvResult.summary.created,  l: "créés",        c: "new"   },
              { v: csvResult.summary.enrolled, l: "enrôlés",      c: "ok"    },
              { v: csvResult.summary.skipped,  l: "déjà enrôlés", c: "skip"  },
            ].map(s => (
              <div key={s.l} className={`ep-stat ep-stat-${s.c}`}>
                <span className="ep-sv">{s.v}</span>
                <span className="ep-sl">{s.l}</span>
              </div>
            ))}
          </div>
          {csvResult.skipped.length > 0 && (
            <div className="ep-csv-detail" style={{ marginTop: 8 }}>
              <div className="ep-csv-dl-title" style={{ color: "#d97706" }}>
                ℹ️ Déjà enrôlés ({csvResult.summary.skipped} au total)
                {csvResult.summary.skipped > 100 && <span className="ep-csv-dl-note"> — affichage limité aux 100 premiers</span>}
              </div>
              <div className="ep-chips">{csvResult.skipped.map(e => <span key={e} className="ep-chip ep-chip-skip">{e}</span>)}</div>
            </div>
          )}
          <button className="mod-btn mod-btn-outline" style={{ marginTop: 8 }} onClick={() => { setCsvResult(null); setCsvFile(null) }}>
            ↩ Nouvel import
          </button>
        </div>
      )}

      <div className="ep-list-header">
        <span>Utilisateurs enrôlés</span>
        <span className="mod-count">{enrolled.length}</span>
      </div>
      {loadingList
        ? <div className="mod-loading"><span className="mod-spinner" /> Chargement…</div>
        : enrolled.length === 0
          ? <div className="mod-empty">Aucun utilisateur enrôlé</div>
          : enrolled.map(u => (
            <div key={u.id} className="ep-row">
              <div className="ep-uinfo">
                <span className="ep-uname">{u.name}</span>
                <span className="ep-uemail">{u.email}</span>
                <span className="ep-date">Enrôlé le {new Date(u.enrolledAt).toLocaleDateString("fr-FR")}</span>
              </div>
              <button className="mod-btn mod-btn-delete ep-sm" disabled={removing === u.id} onClick={() => unenroll(u.id)}>
                {removing === u.id ? "…" : "Retirer"}
              </button>
            </div>
          ))
      }
    </div>
  )
}

// ── CreateRoomModal ──
function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", chatEnabled: true, participationEnabled: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError("Le titre est requis"); return }
    setLoading(true); setError("")
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
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="modal-field">
            <label>Description (optionnelle)</label>
            <input type="text" placeholder="Description de la salle"
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="modal-toggle" onClick={() => setForm({ ...form, chatEnabled: !form.chatEnabled })}>
            <span>Activer le chat</span>
            <div className={`toggle ${form.chatEnabled ? "on" : ""}`}><div className="thumb" /></div>
          </div>
          <div className="modal-toggle" onClick={() => setForm({ ...form, participationEnabled: !form.participationEnabled })}>
            <span>Autoriser la participation</span>
            <div className={`toggle ${form.participationEnabled ? "on" : ""}`}><div className="thumb" /></div>
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
    </div>
  )
}

// ── Page principale ──
export default function ModeratorClient({ user }: { user: User }) {
  const [tab, setTab] = useState<"rooms" | "recordings">("rooms")
  const [rooms, setRooms] = useState<Room[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [activeRoomTab, setActiveRoomTab] = useState<Record<string, "enroll" | "settings">>({})

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    const d = await (await fetch("/api/admin/rooms")).json()
    setRooms(d.rooms ?? [])
    setLoading(false)
  }, [])

  const fetchRecordings = useCallback(async () => {
    setLoading(true)
    const d = await (await fetch("/api/recordings/me")).json()
    setRecordings(d.recordings ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tab === "rooms") fetchRooms()
    if (tab === "recordings") fetchRecordings()
  }, [tab, fetchRooms, fetchRecordings])

  const startMeeting = async (room: Room) => {
    const res = await fetch("/api/create_stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_name: room.roomName,
        metadata: {
          creator_identity: user.name ?? user.email ?? "Modérateur",
          enable_chat: room.chatEnabled,
          allow_participation: room.participationEnabled,
        },
      }),
    })
    if (!res.ok) { alert("Erreur démarrage"); return }
    const data = await res.json()
    window.location.href = `/host?at=${data.auth_token}&rt=${data.connection_details.token}`
  }

  const copyLink = (roomName: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/watch/${roomName}`)
    alert("Lien copié !")
  }

  const deleteRoom = async (id: string) => {
    if (!confirm("Supprimer cette salle ?")) return
    setDeleting(id)
    await fetch(`/api/rooms/${id}`, { method: "DELETE" })
    await fetchRooms()
    setDeleting(null)
    if (selectedRoom?.id === id) setSelectedRoom(null)
  }

  const roomTab = (id: string) => activeRoomTab[id] ?? "enroll"
  const setRoomTab = (id: string, t: "enroll" | "settings") =>
    setActiveRoomTab(prev => ({ ...prev, [id]: t }))

  return (
    <div className="mod-root">
      <header className="mod-header">
        <a href="/" className="mod-logo-link">
          <Image src="/logo-unchk.png" alt="UN-CHK" width={110} height={44} style={{ objectFit: "contain" }} priority />
        </a>
        <div className="mod-header-center">
          <span className="mod-role-badge">Modérateur</span>
          <span className="mod-username">{user.name ?? user.email}</span>
        </div>
        <div className="mod-header-right">
          <button className="mod-btn mod-btn-outline" onClick={() => signOut({ callbackUrl: "/" })}>
            Déconnexion
          </button>
        </div>
      </header>

      <div className="mod-page-title">
        <h1>Mes webinaires</h1>
        <p>Gérez vos salles et enrôlez vos participants</p>
      </div>

      <div className="mod-tabs-wrap">
        <div className="mod-tabs">
          <button className={`mod-tab${tab === "rooms" ? " active" : ""}`} onClick={() => setTab("rooms")}>
            Salles{rooms.length > 0 ? ` (${rooms.length})` : ""}
          </button>
          <button className={`mod-tab${tab === "recordings" ? " active" : ""}`} onClick={() => setTab("recordings")}>
            Enregistrements{recordings.length > 0 ? ` (${recordings.length})` : ""}
          </button>
        </div>
      </div>

      <main className="mod-main">

        {tab === "rooms" && (
          <div className="mod-rooms-wrap">
            <div className="mod-rooms-toolbar">
              <span className="mod-count">{rooms.length} salle{rooms.length > 1 ? "s" : ""}</span>
              <button className="mod-btn mod-btn-primary" onClick={() => setShowCreate(true)}>
                + Créer une salle
              </button>
            </div>

            {loading
              ? <div className="mod-loading"><span className="mod-spinner" /> Chargement…</div>
              : rooms.length === 0
                ? (
                  <div className="mod-empty-state">
                    <div className="mod-empty-icon">🏠</div>
                    <p>Vous n&apos;avez pas encore de salle</p>
                    <button className="mod-btn mod-btn-primary" onClick={() => setShowCreate(true)}>
                      Créer votre première salle
                    </button>
                  </div>
                )
                : (
                  <div className="mod-rooms-layout">
                    <div className="mod-card mod-rooms-list">
                      <div className="mod-card-header">
                        <span className="mod-card-title">Mes salles</span>
                      </div>
                      {rooms.map(room => (
                        <div key={room.id}
                          className={`mod-room-item${selectedRoom?.id === room.id ? " active" : ""}`}
                          onClick={() => setSelectedRoom(room)}>
                          <div className="mod-room-item-top">
                            <span className="mod-room-title">{room.title}</span>
                            {room.status === "LIVE" && <span className="mod-live-dot">● LIVE</span>}
                          </div>
                          <div className="mod-room-meta">
                            {room.enrollments} enrôlé{room.enrollments > 1 ? "s" : ""}
                            {room.recordings > 0 ? ` · ${room.recordings} enreg.` : ""}
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedRoom ? (
                      <div className="mod-card mod-room-panel">
                        <div className="mod-room-panel-header">
                          <div>
                            <h2 className="mod-room-panel-title">{selectedRoom.title}</h2>
                            {selectedRoom.description && (
                              <p className="mod-room-panel-desc">{selectedRoom.description}</p>
                            )}
                          </div>
                          <div className="mod-room-panel-actions">
                            <button className="mod-btn mod-btn-outline"
                              onClick={() => copyLink(selectedRoom.roomName)}>
                              Copier le lien
                            </button>
                            <button className="mod-btn mod-btn-primary"
                              onClick={() => startMeeting(selectedRoom)}>
                              ▶ Démarrer
                            </button>
                          </div>
                        </div>

                        <div className="mod-subtabs">
                          <button className={`mod-subtab${roomTab(selectedRoom.id) === "enroll" ? " active" : ""}`}
                            onClick={() => setRoomTab(selectedRoom.id, "enroll")}>
                            Participants
                          </button>
                          <button className={`mod-subtab${roomTab(selectedRoom.id) === "settings" ? " active" : ""}`}
                            onClick={() => setRoomTab(selectedRoom.id, "settings")}>
                            Paramètres
                          </button>
                        </div>

                        {roomTab(selectedRoom.id) === "enroll" && (
                          <EnrollPanel sessionId={selectedRoom.id} sessionTitle={selectedRoom.title} />
                        )}

                        {roomTab(selectedRoom.id) === "settings" && (
                          <div className="mod-settings">
                            <div className="mod-setting-row">
                              <span>Identifiant</span>
                              <code>{selectedRoom.roomName}</code>
                            </div>
                            <div className="mod-setting-row">
                              <span>Lien spectateur</span>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <code style={{ fontSize: "0.72rem" }}>/watch/{selectedRoom.roomName}</code>
                                <button className="mod-btn-copy-sm"
                                  onClick={() => copyLink(selectedRoom.roomName)}>Copier</button>
                              </div>
                            </div>
                            <div className="mod-setting-row">
                              <span>Chat</span>
                              <span className={`mod-badge ${selectedRoom.chatEnabled ? "on" : "off"}`}>
                                {selectedRoom.chatEnabled ? "Activé" : "Désactivé"}
                              </span>
                            </div>
                            <div className="mod-setting-row">
                              <span>Participation</span>
                              <span className={`mod-badge ${selectedRoom.participationEnabled ? "on" : "off"}`}>
                                {selectedRoom.participationEnabled ? "Activée" : "Désactivée"}
                              </span>
                            </div>
                            <div className="mod-setting-row">
                              <span>Statut</span>
                              <span className={`mod-badge ${selectedRoom.status === "LIVE" ? "on" : "off"}`}>
                                {selectedRoom.status === "LIVE" ? "🔴 En direct"
                                  : selectedRoom.status === "ENDED" ? "Terminée" : "Programmée"}
                              </span>
                            </div>
                            <div className="mod-setting-row">
                              <span>Créée le</span>
                              <span style={{ fontSize: "0.82rem", color: "#6b7280" }}>
                                {new Date(selectedRoom.createdAt).toLocaleDateString("fr-FR")}
                              </span>
                            </div>
                            <button className="mod-btn mod-btn-delete"
                              disabled={deleting === selectedRoom.id}
                              onClick={() => deleteRoom(selectedRoom.id)}>
                              {deleting === selectedRoom.id ? "Suppression…" : "Supprimer la salle"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mod-card mod-room-panel">
                        <div className="mod-empty" style={{ padding: 48 }}>
                          Sélectionnez une salle pour gérer ses participants
                        </div>
                      </div>
                    )}
                  </div>
                )
            }
          </div>
        )}

        {tab === "recordings" && (
          <div className="mod-card">
            <div className="mod-card-header">
              <span className="mod-card-title">Enregistrements de mes salles</span>
              <span className="mod-count">{recordings.length}</span>
            </div>
            {loading
              ? <div className="mod-loading"><span className="mod-spinner" /> Chargement…</div>
              : recordings.length === 0
                ? <div className="mod-empty">Aucun enregistrement disponible</div>
                : recordings.map(rec => (
                  <div key={rec.id} className="mod-rec-item">
                    <div className="mod-rec-row">
                      <svg className="mod-rec-icon" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
                      </svg>
                      <div className="mod-rec-info">
                        <span className="mod-rec-filename">{rec.filename}</span>
                        <div className="mod-rec-meta">
                          <span>🏠 {rec.session.title}</span>
                          {rec.duration != null && <span>⏱ {formatDuration(rec.duration)}</span>}
                          {rec.size != null && <span>💾 {formatSize(rec.size)}</span>}
                          <span>{new Date(rec.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                        </div>
                      </div>
                      <div className="mod-rec-actions">
                        <button className="mod-btn mod-btn-primary"
                          onClick={() => setPlayingKey(playingKey === rec.s3Key ? null : rec.s3Key)}>
                          {playingKey === rec.s3Key ? "✖ Fermer" : "▶ Voir"}
                        </button>
                        <a href={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}
                          className="mod-btn mod-btn-green" target="_blank" rel="noopener noreferrer">
                          ⬇ Télécharger
                        </a>
                      </div>
                    </div>
                    {playingKey === rec.s3Key && (
                      <div className="mod-rec-player">
                        <video controls autoPlay
                          src={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}>
                          Votre navigateur ne supporte pas la lecture vidéo.
                        </video>
                      </div>
                    )}
                  </div>
                ))
            }
          </div>
        )}
      </main>

      <footer className="mod-footer">
        <p>Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation</p>
        <p className="mod-footer-strong">Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
        <p className="mod-footer-copy">© DITSI – UN-CHK – 2026 – Tous droits réservés</p>
      </footer>

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { fetchRooms(); setShowCreate(false) }}
        />
      )}

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        .mod-root{min-height:100vh;display:flex;flex-direction:column;background:#f8fafd;font-family:'Google Sans','Segoe UI',system-ui,sans-serif;color:#1a1a2e;}
        .mod-header{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:64px;background:#fff;border-bottom:1px solid #e2e8f0;}
        .mod-logo-link{display:flex;align-items:center;}
        .mod-header-center{display:flex;align-items:center;gap:10px;}
        .mod-header-right{display:flex;align-items:center;gap:12px;}
        .mod-role-badge{background:#dbeafe;color:#1e40af;font-size:0.72rem;font-weight:700;padding:3px 10px;border-radius:10px;text-transform:uppercase;}
        .mod-username{font-size:0.88rem;color:#374151;font-weight:500;}
        .mod-page-title{padding:28px 32px 0;}
        .mod-page-title h1{font-size:1.6rem;font-weight:700;}
        .mod-page-title p{font-size:0.88rem;color:#6b7280;margin-top:4px;}
        .mod-tabs-wrap{padding:20px 32px 0;}
        .mod-tabs{display:flex;border-bottom:2px solid #e2e8f0;}
        .mod-tab{padding:10px 24px;background:none;border:none;font-family:inherit;font-size:0.88rem;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s;}
        .mod-tab:hover{color:#0065b1;}
        .mod-tab.active{color:#0065b1;border-bottom-color:#0065b1;font-weight:700;}
        .mod-main{flex:1;max-width:1140px;width:100%;margin:0 auto;padding:24px 32px 40px;}
        .mod-rooms-wrap{display:flex;flex-direction:column;gap:16px;}
        .mod-rooms-toolbar{display:flex;align-items:center;justify-content:space-between;}
        .mod-rooms-layout{display:flex;gap:16px;align-items:flex-start;}
        .mod-rooms-list{width:280px;flex-shrink:0;}
        .mod-room-panel{flex:1;min-width:0;}
        .mod-card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;}
        .mod-card-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #f0f7ff;}
        .mod-card-title{font-size:0.95rem;font-weight:700;}
        .mod-count{background:#e8f4ff;color:#0065b1;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px;}
        .mod-room-item{padding:12px 18px;cursor:pointer;border-bottom:1px solid #f0f7ff;border-left:3px solid transparent;transition:background .12s;}
        .mod-room-item:last-child{border-bottom:none;}
        .mod-room-item:hover{background:#f8fbff;}
        .mod-room-item.active{background:#e8f4ff;border-left-color:#0065b1;}
        .mod-room-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
        .mod-room-title{font-size:0.88rem;font-weight:600;color:#1a1a2e;}
        .mod-live-dot{font-size:0.7rem;font-weight:700;color:#2fb344;}
        .mod-room-meta{font-size:0.74rem;color:#9ca3af;margin-top:3px;}
        .mod-room-panel-header{display:flex;align-items:flex-start;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #f0f7ff;gap:12px;}
        .mod-room-panel-title{font-size:1.05rem;font-weight:700;color:#1a1a2e;}
        .mod-room-panel-desc{font-size:0.82rem;color:#6b7280;margin-top:4px;}
        .mod-room-panel-actions{display:flex;gap:8px;flex-shrink:0;}
        .mod-subtabs{display:flex;padding:0 24px;border-bottom:1px solid #f0f7ff;}
        .mod-subtab{padding:10px 16px;background:none;border:none;font-family:inherit;font-size:0.84rem;font-weight:500;color:#9ca3af;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s;}
        .mod-subtab.active{color:#0065b1;border-bottom-color:#0065b1;font-weight:700;}
        .mod-settings{padding:16px 24px;display:flex;flex-direction:column;gap:12px;}
        .mod-setting-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f7ff;font-size:0.88rem;color:#374151;}
        .mod-setting-row code{background:#f1f5f9;padding:3px 8px;border-radius:5px;font-size:0.78rem;}
        .mod-badge{padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;}
        .mod-badge.on{background:#dcfce7;color:#2fb344;}
        .mod-badge.off{background:#f1f5f9;color:#94a3b8;}
        .mod-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 16px;border-radius:8px;font-size:0.83rem;font-weight:600;font-family:inherit;cursor:pointer;text-decoration:none;border:none;white-space:nowrap;transition:filter .15s;}
        .mod-btn-outline:hover:not(:disabled){background:#e8f4ff;} .mod-btn-primary:hover:not(:disabled){background:#004d8c;} .mod-btn-green:hover:not(:disabled){background:#e6f7eb;} .mod-btn-delete:hover:not(:disabled){background:#fff0f0;}
        .mod-btn:disabled{opacity:.45;cursor:not-allowed;}
        .mod-btn-outline{background:#fff;border:1.5px solid #0065b1;color:#0065b1;}
        .mod-btn-primary{background:#0065b1;color:#fff;}
        .mod-btn-green{background:#fff;border:1.5px solid #2fb344;color:#2fb344;}
        .mod-btn-delete{margin-top:8px;background:#fff;border:1.5px solid #e53e3e;color:#e53e3e;}
        .mod-btn-copy-sm{padding:3px 10px;background:white;border:1px solid #e2e8f0;border-radius:5px;font-size:0.75rem;color:#5f6368;cursor:pointer;font-family:inherit;}
        .mod-loading{display:flex;align-items:center;gap:10px;padding:40px 24px;color:#9ca3af;}
        .mod-spinner{width:16px;height:16px;border:2px solid #e2e8f0;border-top-color:#0065b1;border-radius:50%;animation:mod-spin .7s linear infinite;display:inline-block;}
        @keyframes mod-spin{to{transform:rotate(360deg)}}
        .mod-empty{padding:40px;text-align:center;color:#9ca3af;font-size:0.9rem;}
        .mod-empty-state{display:flex;flex-direction:column;align-items:center;gap:16px;padding:80px 0;color:#9ca3af;}
        .mod-empty-icon{font-size:3rem;}
        .mod-rec-item{border-bottom:1px solid #f0f7ff;}
        .mod-rec-item:last-child{border-bottom:none;}
        .mod-rec-row{display:flex;align-items:center;gap:14px;padding:14px 20px;}
        .mod-rec-icon{width:26px;height:26px;color:#0065b1;flex-shrink:0;}
        .mod-rec-info{flex:1;min-width:0;}
        .mod-rec-filename{font-size:0.88rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;}
        .mod-rec-meta{display:flex;gap:12px;margin-top:4px;flex-wrap:wrap;}
        .mod-rec-meta span{font-size:0.75rem;color:#9ca3af;}
        .mod-rec-actions{display:flex;gap:8px;flex-shrink:0;}
        .mod-rec-player{padding:0 20px 16px;}
        .mod-rec-player video{width:100%;max-height:400px;border-radius:8px;background:#000;display:block;}
        .mod-footer{background:#fff;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;display:flex;flex-direction:column;gap:3px;margin-top:auto;}
        .mod-footer p{font-size:0.78rem;color:#6b7280;}
        .mod-footer-strong{font-size:0.88rem;font-weight:700;color:#0065b1!important;}
        .mod-footer-copy{font-size:0.72rem;color:#9ca3af!important;}
        .ep-root{display:flex;flex-direction:column;}
        .ep-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #f0f7ff;gap:12px;flex-wrap:wrap;}
        .ep-title{font-size:0.9rem;font-weight:700;color:#1a1a2e;}
        .ep-tabs{display:flex;gap:4px;}
        .ep-tab{padding:5px 14px;border:1.5px solid #d1e4f5;background:white;border-radius:20px;font-size:0.78rem;font-weight:600;color:#6b7280;cursor:pointer;font-family:inherit;transition:all .15s;}
        .ep-tab.active{background:#0065b1;border-color:#0065b1;color:#fff;}
        .ep-search{display:flex;align-items:center;gap:8px;padding:12px 20px;border-bottom:1px solid #f0f7ff;}
        .ep-input{flex:1;padding:7px 11px;border:1.5px solid #d1e4f5;border-radius:7px;font-size:0.83rem;font-family:inherit;outline:none;color:#1a1a2e;}
        .ep-input:focus{border-color:#0065b1;}
        .ep-spinner{width:14px;height:14px;border:2px solid #d1e4f5;border-top-color:#0065b1;border-radius:50%;animation:mod-spin .7s linear infinite;flex-shrink:0;display:inline-block;}
        .ep-results{background:#f8fbff;border-bottom:1px solid #f0f7ff;}
        .ep-row{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-bottom:1px solid #f0f7ff;}
        .ep-row:last-child{border-bottom:none;}
        .ep-uinfo{display:flex;flex-direction:column;gap:2px;}
        .ep-uname{font-size:0.84rem;font-weight:600;color:#1a1a2e;}
        .ep-uemail{font-size:0.74rem;color:#9ca3af;}
        .ep-date{font-size:0.7rem;color:#c4cdd9;}
        .ep-list-header{display:flex;align-items:center;gap:8px;padding:10px 20px;background:#f8fbff;border-bottom:1px solid #f0f7ff;border-top:1px solid #f0f7ff;}
        .ep-list-header span{font-size:0.78rem;font-weight:600;color:#6b7280;}
        .ep-sm{padding:5px 11px;font-size:0.76rem;}
        .ep-csv{padding:14px 20px;border-bottom:1px solid #f0f7ff;display:flex;flex-direction:column;gap:10px;}
        .ep-csv-info-bar{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .ep-csv-info{font-size:0.72rem;color:#9ca3af;line-height:1.6;}
        .ep-csv-info code{font-family:monospace;font-size:0.76rem;background:#e8f4ff;padding:1px 4px;border-radius:3px;color:#0065b1;}
        .ep-csv-info strong{color:#374151;}
        .ep-csv-dl{display:inline-flex;align-items:center;gap:5px;font-size:0.76rem;color:#0065b1;text-decoration:none;font-weight:600;white-space:nowrap;padding:5px 12px;border:1.5px solid #0065b1;border-radius:7px;transition:background .15s;flex-shrink:0;}
        .ep-csv-dl:hover{background:#e8f4ff;}
        .ep-dropzone{border:2px dashed #d1e4f5;border-radius:10px;padding:24px 20px;text-align:center;cursor:pointer;transition:all .15s;}
        .ep-dropzone:hover,.ep-dropzone.drag{border-color:#0065b1;background:#f0f7ff;}
        .ep-dropzone.ok{border-color:#2fb344;background:#f0fdf4;}
        .ep-dropzone-content{display:flex;flex-direction:column;align-items:center;gap:6px;}
        .ep-dropzone-icon{font-size:1.8rem;}
        .ep-hint{font-size:0.82rem;color:#6b7280;font-weight:500;}
        .ep-hint-sub{font-size:0.72rem;color:#9ca3af;}
        .ep-fname{font-size:0.84rem;color:#1a1a2e;font-weight:600;}
        .ep-csv-err{font-size:0.78rem;color:#b91c1c;background:#fff0f0;border:1px solid #fecaca;border-radius:6px;padding:8px 12px;}
        .ep-progress-wrap{display:flex;flex-direction:column;gap:5px;}
        .ep-progress-bar{width:100%;height:5px;background:#e8f4ff;border-radius:3px;overflow:hidden;}
        .ep-progress-fill{height:100%;width:40%;background:#0065b1;border-radius:3px;animation:ep-progress 1.4s ease-in-out infinite;}
        @keyframes ep-progress{0%{transform:translateX(-150%)}100%{transform:translateX(350%)}}
        .ep-progress-label{font-size:0.72rem;color:#0065b1;font-weight:500;}
        .ep-csv-success-banner{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:7px;padding:8px 14px;font-size:0.82rem;font-weight:600;color:#2fb344;}
        .ep-csv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
        .ep-stat{display:flex;flex-direction:column;align-items:center;padding:12px 6px;border-radius:8px;gap:3px;}
        .ep-sv{font-size:1.4rem;font-weight:700;}.ep-sl{font-size:0.68rem;font-weight:600;}
        .ep-stat-total{background:#f8fbff;}.ep-stat-total .ep-sv{color:#0065b1;}.ep-stat-total .ep-sl{color:#9ca3af;}
        .ep-stat-new{background:#eff6ff;}.ep-stat-new .ep-sv{color:#3b82f6;}.ep-stat-new .ep-sl{color:#3b82f6;}
        .ep-stat-ok{background:#f0fdf4;}.ep-stat-ok .ep-sv{color:#2fb344;}.ep-stat-ok .ep-sl{color:#2fb344;}
        .ep-stat-skip{background:#fffbeb;}.ep-stat-skip .ep-sv{color:#d97706;}.ep-stat-skip .ep-sl{color:#d97706;}
        .ep-csv-detail{background:#f8fbff;border:1px solid #e8f4ff;border-radius:7px;padding:10px;}
        .ep-csv-dl-title{font-size:0.76rem;font-weight:700;color:#1a1a2e;margin-bottom:6px;}
        .ep-csv-dl-note{font-size:0.7rem;color:#9ca3af;font-weight:400;}
        .ep-chips{display:flex;flex-wrap:wrap;gap:5px;max-height:120px;overflow-y:auto;}
        .ep-chip{font-size:0.7rem;padding:2px 8px;border-radius:20px;font-weight:500;}
        .ep-chip-skip{background:#fffbeb;color:#d97706;}
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
        @media(max-width:900px){
          .mod-rooms-layout{flex-direction:column;}
          .mod-rooms-list{width:100%;}
          .mod-header,.mod-page-title,.mod-tabs-wrap,.mod-main{padding-left:16px;padding-right:16px;}
        }
      `}</style>
    </div>
  )
}
