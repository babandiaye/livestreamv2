"use client"

import { useState, useEffect, useCallback } from "react"
import { signOut } from "next-auth/react"

type Room = {
  id: string; roomName: string; title: string; description: string | null
  status: string; chatEnabled: boolean; participationEnabled: boolean
  createdAt: string; updatedAt: string; recordings: number; enrollments: number
}
type Recording = {
  id: string; filename: string; s3Key: string; duration: number | null
  size: number | null; createdAt: string
  session: { id: string; title: string; roomName: string; creator: { name: string; email: string } }
}
type EnrolledUser = { id: string; userId: string; name: string; email: string; role: string; enrolledAt: string }
type SearchUser = { id: string; name: string; email: string; role: string }
type ImportResult = { summary: { total: number; created: number; enrolled: number; skipped: number }; skipped: string[] }
type User = { id: string; name?: string | null; email?: string | null; role: string }

const PAGE_SIZE = 50

function formatDuration(seconds: number | null) {
  if (!seconds) return ""
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}m` : `${m}:${s.toString().padStart(2, "0")}`
}
function formatSize(b: number) {
  if (!b) return "—"
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  if (b < 1024 ** 3) return `${(b / (1024 * 1024)).toFixed(1)} Mo`
  return `${(b / 1024 ** 3).toFixed(2)} Go`
}
function initials(name: string) {
  return (name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}
function Avatar({ name, color = "#0065b1", size = 30 }: { name: string; color?: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 600, color: "white", flexShrink: 0 }}>
      {initials(name)}
    </div>
  )
}
function Pagination({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #f0f7ff", background: "#f8fbff" }}>
      <span style={{ fontSize: 13, color: "#6b7280" }}>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total}</span>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "white", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? .4 : 1, fontSize: 13 }}>←</button>
        {Array.from({ length: pages }, (_, i) => i + 1).filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1).map((p, i, arr) => (
          <span key={p}>
            {i > 0 && arr[i - 1] !== p - 1 && <span style={{ padding: "4px 6px", fontSize: 13, color: "#9ca3af" }}>…</span>}
            <button onClick={() => onPage(p)} style={{ padding: "4px 10px", border: "1px solid", borderColor: p === page ? "#0065b1" : "#e2e8f0", borderRadius: 6, background: p === page ? "#0065b1" : "white", color: p === page ? "white" : "#374151", cursor: "pointer", fontSize: 13, fontWeight: p === page ? 600 : 400 }}>{p}</button>
          </span>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === pages} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "white", cursor: page === pages ? "not-allowed" : "pointer", opacity: page === pages ? .4 : 1, fontSize: 13 }}>→</button>
      </div>
    </div>
  )
}

// ── EnrollPanel ──
function EnrollPanel({ sessionId }: { sessionId: string }) {
  const [subTab, setSubTab] = useState<"manual" | "csv" | "list">("list")
  const [enrolled, setEnrolled] = useState<EnrolledUser[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [enrollPage, setEnrollPage] = useState(1)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvDrag, setCsvDrag] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  const fetchEnrolled = useCallback(async () => {
    setLoadingList(true)
    const d = await (await fetch(`/api/admin/rooms/${sessionId}/enroll`)).json()
    setEnrolled(d.enrollments ?? []); setEnrollPage(1); setLoadingList(false)
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
    await fetch(`/api/admin/rooms/${sessionId}/enroll`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
    setQuery(""); setResults([]); await fetchEnrolled(); setAdding(null)
  }
  const unenroll = async (userId: string) => {
    setRemoving(userId)
    await fetch(`/api/admin/rooms/${sessionId}/enroll`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
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

  const pagedEnrolled = enrolled.slice((enrollPage - 1) * PAGE_SIZE, enrollPage * PAGE_SIZE)

  const tabStyle = (t: string) => ({
    padding: "10px 16px", background: "none", border: "none",
    borderBottom: `2px solid ${subTab === t ? "#0065b1" : "transparent"}`,
    color: subTab === t ? "#0065b1" : "#9ca3af",
    fontSize: 14, fontWeight: subTab === t ? 600 : 400, cursor: "pointer", fontFamily: "inherit"
  })

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #f0f7ff", padding: "0 16px" }}>
        <button style={tabStyle("list")} onClick={() => setSubTab("list")}>
          Participants <span style={{ background: "#e8f4ff", color: "#0065b1", fontSize: 12, padding: "1px 6px", borderRadius: 10, marginLeft: 4 }}>{enrolled.length}</span>
        </button>
        <button style={tabStyle("manual")} onClick={() => setSubTab("manual")}>Ajouter</button>
        <button style={tabStyle("csv")} onClick={() => setSubTab("csv")}>Import CSV</button>
      </div>

      {/* Liste participants */}
      {subTab === "list" && (
        <>
          {loadingList
            ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px 16px", color: "#9ca3af", fontSize: 14 }}><span style={{ width: 14, height: 14, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "mod-spin .7s linear infinite", display: "inline-block" }} />Chargement…</div>
            : enrolled.length === 0
              ? <div style={{ padding: "30px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Aucun participant enrôlé</div>
              : (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fbff" }}>
                        {["Participant", "Email", "Enrôlé le", ""].map(h => (
                          <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #f0f7ff" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedEnrolled.map(u => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #f0f7ff" }}>
                          <td style={{ padding: "10px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Avatar name={u.name} size={28} />
                              <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{u.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 13, color: "#6b7280" }}>{u.email}</td>
                          <td style={{ padding: "10px 16px", fontSize: 13, color: "#9ca3af" }}>{new Date(u.enrolledAt).toLocaleDateString("fr-FR")}</td>
                          <td style={{ padding: "10px 16px" }}>
                            <button disabled={removing === u.userId} onClick={() => unenroll(u.userId)}
                              style={{ padding: "4px 12px", background: "white", color: "#e53e3e", border: "1px solid #e53e3e", borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: removing === u.userId ? .5 : 1 }}>
                              {removing === u.userId ? "…" : "Retirer"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination total={enrolled.length} page={enrollPage} onPage={setEnrollPage} />
                </>
              )
          }
        </>
      )}

      {/* Ajouter manuellement */}
      {subTab === "manual" && (
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input placeholder="Rechercher un utilisateur…" value={query} onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", color: "#1a1a2e", background: "#f8fbff" }} />
            {searching && <span style={{ width: 14, height: 14, border: "2px solid #d1e4f5", borderTopColor: "#0065b1", borderRadius: "50%", animation: "mod-spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />}
          </div>
          {results.length > 0 && (
            <div style={{ background: "#f8fbff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              {results.map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #f0f7ff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={u.name} size={28} />
                    <div><div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{u.name}</div><div style={{ fontSize: 13, color: "#9ca3af" }}>{u.email}</div></div>
                  </div>
                  <button disabled={adding === u.id} onClick={() => enroll(u.id)}
                    style={{ padding: "5px 14px", background: "#0065b1", color: "white", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: adding === u.id ? .5 : 1 }}>
                    {adding === u.id ? "…" : "+ Ajouter"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {query.length >= 2 && results.length === 0 && !searching && (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Aucun utilisateur trouvé</div>
          )}
        </div>
      )}

      {/* Import CSV */}
      {subTab === "csv" && !csvResult && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
              Colonnes : <code style={{ background: "#e8f4ff", color: "#0065b1", padding: "1px 5px", borderRadius: 3, fontSize: 13 }}>email</code> · <code style={{ background: "#e8f4ff", color: "#0065b1", padding: "1px 5px", borderRadius: 3, fontSize: 13 }}>email,prenom,nom</code>
              <br />Jusqu&apos;à <strong style={{ color: "#374151" }}>10 000 utilisateurs</strong>. Créés automatiquement si inexistants.
            </div>
            <a href="/api/admin/enroll-csv-template" download style={{ fontSize: 13, color: "#0065b1", textDecoration: "none", fontWeight: 600, padding: "5px 12px", border: "1px solid #0065b1", borderRadius: 7, whiteSpace: "nowrap" }}>⬇ Modèle CSV</a>
          </div>
          <div
            onClick={() => document.getElementById("csv-input-mod")?.click()}
            onDragOver={e => { e.preventDefault(); setCsvDrag(true) }}
            onDragLeave={() => setCsvDrag(false)}
            onDrop={e => { e.preventDefault(); setCsvDrag(false); const f = e.dataTransfer.files[0]; if (f) setCsvFile(f) }}
            style={{ border: `2px dashed ${csvDrag ? "#0065b1" : csvFile ? "#2fb344" : "#d1e4f5"}`, background: csvFile ? "#f0fdf4" : csvDrag ? "#f0f7ff" : "white", borderRadius: 10, padding: "24px", textAlign: "center", cursor: "pointer" }}>
            <input id="csv-input-mod" type="file" accept=".csv" style={{ display: "none" }} onChange={e => e.target.files?.[0] && setCsvFile(e.target.files[0])} />
            {csvFile
              ? <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>📄 {csvFile.name}</span>
              : <div><div style={{ fontSize: 22, marginBottom: 6 }}>📂</div><span style={{ fontSize: 14, color: "#6b7280" }}>Glisser un fichier CSV ici ou cliquer</span></div>
            }
          </div>
          {csvError && <div style={{ fontSize: 13, color: "#b91c1c", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 7, padding: "8px 12px" }}>⚠️ {csvError}</div>}
          {csvLoading && <div style={{ height: 5, background: "#e8f4ff", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: "40%", background: "#0065b1", borderRadius: 3, animation: "ep-progress 1.4s ease-in-out infinite" }} /></div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {csvFile && !csvLoading && <button onClick={() => setCsvFile(null)} style={{ padding: "6px 14px", background: "white", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>}
            <button onClick={submitCsv} disabled={!csvFile || csvLoading}
              style={{ padding: "6px 16px", background: "#0065b1", color: "white", border: "none", borderRadius: 7, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: !csvFile || csvLoading ? .5 : 1 }}>
              {csvLoading ? "Import en cours…" : "Importer"}
            </button>
          </div>
        </div>
      )}

      {subTab === "csv" && csvResult && (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontWeight: 600, color: "#2fb344" }}>✅ Import terminé avec succès</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[{ v: csvResult.summary.total, l: "lus", bg: "#f8fbff", c: "#0065b1" }, { v: csvResult.summary.created, l: "créés", bg: "#eff6ff", c: "#3b82f6" }, { v: csvResult.summary.enrolled, l: "enrôlés", bg: "#f0fdf4", c: "#2fb344" }, { v: csvResult.summary.skipped, l: "déjà enrôlés", bg: "#fffbeb", c: "#d97706" }].map(s => (
              <div key={s.l} style={{ background: s.bg, borderRadius: 8, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: s.c }}>{s.v}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.c }}>{s.l}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { setCsvResult(null); setCsvFile(null) }} style={{ padding: "6px 14px", background: "white", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 14, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>↩ Nouvel import</button>
        </div>
      )}
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
    const res = await fetch("/api/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    if (!res.ok) { setError("Erreur création salle"); setLoading(false); return }
    onCreated()
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#1a1a2e" }}>Créer une nouvelle salle</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#94a3b8", width: 30, height: 30, borderRadius: "50%" }}>✕</button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#5f6368" }}>Nom de la salle *</label>
            <input type="text" placeholder="ex: Introduction au Machine Learning" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} autoFocus
              style={{ padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#5f6368" }}>Description (optionnelle)</label>
            <input type="text" placeholder="Description de la salle" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
          </div>
          {[{ label: "Activer le chat", key: "chatEnabled" as const }, { label: "Autoriser la participation", key: "participationEnabled" as const }].map(({ label, key }) => (
            <div key={key} onClick={() => setForm({ ...form, [key]: !form[key] })}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: 14, color: "#1a1a2e" }}>
              <span>{label}</span>
              <div style={{ width: 40, height: 22, borderRadius: 11, background: form[key] ? "#0065b1" : "#e2e8f0", position: "relative", transition: "background .2s" }}>
                <div style={{ position: "absolute", top: 2, left: form[key] ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
              </div>
            </div>
          ))}
          {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}
        </div>
        <div style={{ padding: "14px 22px", display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #e2e8f0" }}>
          <button onClick={onClose} style={{ padding: "8px 18px", border: "1px solid #e2e8f0", borderRadius: 8, background: "white", color: "#5f6368", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
          <button onClick={handleSubmit} disabled={loading} style={{ padding: "8px 20px", background: "#0065b1", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loading ? .5 : 1 }}>
            {loading ? "Création..." : "Créer la salle"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ──
export default function ModeratorClient({ user }: { user: User }) {
  const [nav, setNav] = useState<"rooms" | "recordings">("rooms")
  const [rooms, setRooms] = useState<Room[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [roomSubTab, setRoomSubTab] = useState<"enroll" | "settings">("enroll")
  const [recPage, setRecPage] = useState(1)

  const fetchRooms = useCallback(async () => { setLoading(true); const d = await (await fetch("/api/admin/rooms")).json(); setRooms(d.rooms ?? []); setLoading(false) }, [])
  const fetchRecordings = useCallback(async () => { setLoading(true); const d = await (await fetch("/api/recordings/me")).json(); setRecordings(d.recordings ?? []); setRecPage(1); setLoading(false) }, [])

  useEffect(() => {
    if (nav === "rooms") fetchRooms()
    if (nav === "recordings") fetchRecordings()
  }, [nav, fetchRooms, fetchRecordings])

  const startMeeting = async (room: Room) => {
    const res = await fetch("/api/create_stream", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_name: room.roomName, metadata: { creator_identity: user.name ?? user.email ?? "Modérateur", enable_chat: room.chatEnabled, allow_participation: room.participationEnabled } }),
    })
    if (!res.ok) { alert("Erreur démarrage"); return }
    const data = await res.json()
    window.location.href = `/host?at=${data.auth_token}&rt=${data.connection_details.token}`
  }

  const copyLink = (roomName: string) => { navigator.clipboard.writeText(`${window.location.origin}/watch/${roomName}`); alert("Lien copié !") }

  const deleteRoom = async (id: string) => {
    if (!confirm("Supprimer cette salle ?")) return
    setDeleting(id)
    await fetch(`/api/rooms/${id}`, { method: "DELETE" })
    await fetchRooms(); setDeleting(null)
    if (selectedRoom?.id === id) setSelectedRoom(null)
  }

  const userName = user.name ?? user.email ?? "Modérateur"
  const pagedRecs = recordings.slice((recPage - 1) * PAGE_SIZE, recPage * PAGE_SIZE)

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Google Sans','Segoe UI',system-ui,sans-serif", color: "#1a1a2e", background: "#f8fafd" }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 210, flexShrink: 0, background: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
        {/* Logo */}
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "#0065b1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.259a1 1 0 01-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>
          </div>
          <div><div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e" }}>UN-CHK</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Webinaire</div></div>
        </div>

        {/* Nav principale */}
        <div style={{ padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", padding: "6px 8px 2px", textTransform: "uppercase", letterSpacing: ".05em" }}>Mes espaces</div>
          {[
            { key: "rooms", label: "Mes salles", count: rooms.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.259a1 1 0 01-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg> },
            { key: "recordings", label: "Enregistrements", count: recordings.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg> },
          ].map(item => (
            <button key={item.key} onClick={() => setNav(item.key as any)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, border: "none", background: nav === item.key ? "#e8f4ff" : "none", color: nav === item.key ? "#0065b1" : "#6b7280", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: nav === item.key ? 600 : 400, textAlign: "left", width: "100%" }}>
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.count > 0 && <span style={{ background: nav === item.key ? "#0065b1" : "#f0f7ff", color: nav === item.key ? "white" : "#0065b1", fontSize: 11, padding: "1px 5px", borderRadius: 10, fontWeight: 600 }}>{item.count}</span>}
            </button>
          ))}
        </div>

        {/* Liste salles dans sidebar */}
        {rooms.length > 0 && (
          <div style={{ flex: 1, padding: "0 8px 8px", overflow: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", padding: "8px 8px 4px", textTransform: "uppercase", letterSpacing: ".05em" }}>Salle active</div>
            {rooms.map(room => (
              <button key={room.id} onClick={() => { setSelectedRoom(room); setNav("rooms"); setRoomSubTab("enroll") }}
                style={{ display: "flex", flexDirection: "column", padding: "7px 8px", borderRadius: 8, border: "none", background: selectedRoom?.id === room.id ? "#e8f4ff" : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%", marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: selectedRoom?.id === room.id ? "#0065b1" : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{room.title}</span>
                  {room.status === "LIVE" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0, display: "inline-block" }} />}
                </div>
                <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{room.enrollments} enrôlé{room.enrollments > 1 ? "s" : ""}{room.recordings > 0 ? ` · ${room.recordings} enreg.` : ""}</span>
              </button>
            ))}
          </div>
        )}

        {/* Profil */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid #f0f7ff", display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={userName} color="#2fb344" size={28} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
            <div style={{ fontSize: 11, color: "#2fb344" }}>Modérateur</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/" })} title="Déconnexion"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#e53e3e", padding: 4, borderRadius: 5, display: "flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "0 24px", height: 60, background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>
              {nav === "rooms" ? (selectedRoom ? selectedRoom.title : "Mes salles") : "Enregistrements"}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {nav === "rooms" ? "Gérez vos salles et participants" : "Enregistrements de vos sessions"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {nav === "rooms" && (
              <button onClick={() => setShowCreate(true)}
                style={{ padding: "7px 16px", background: "#0065b1", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                + Créer une salle
              </button>
            )}
          </div>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

          {/* ── SALLES ── */}
          {nav === "rooms" && (
            <>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Mes salles", value: rooms.length, color: "#0065b1" },
                  { label: "Total enrôlés", value: rooms.reduce((a, r) => a + r.enrollments, 0), color: "#2fb344" },
                  { label: "Enregistrements", value: rooms.reduce((a, r) => a + r.recordings, 0), color: "#d97706" },
                ].map(c => (
                  <div key={c.label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 600, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "40px", color: "#9ca3af", fontSize: 14, background: "white", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <span style={{ width: 16, height: 16, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "mod-spin .7s linear infinite", display: "inline-block" }} />Chargement…
                </div>
              ) : rooms.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "60px 0", background: "white", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 36 }}>🏠</div>
                  <p style={{ fontSize: 15, color: "#9ca3af" }}>Vous n&apos;avez pas encore de salle</p>
                  <button onClick={() => setShowCreate(true)} style={{ padding: "8px 20px", background: "#0065b1", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Créer votre première salle</button>
                </div>
              ) : selectedRoom ? (
                /* Panel salle sélectionnée */
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  {/* Header salle */}
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <button onClick={() => setSelectedRoom(null)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 13, padding: 0, fontFamily: "inherit" }}>← Toutes les salles</button>
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 600, color: "#1a1a2e" }}>{selectedRoom.title}</div>
                      {selectedRoom.description && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{selectedRoom.description}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: selectedRoom.status === "LIVE" ? "#dcfce7" : "#f1f5f9", color: selectedRoom.status === "LIVE" ? "#166534" : "#6b7280" }}>
                        {selectedRoom.status === "LIVE" ? "● En direct" : selectedRoom.status === "ENDED" ? "Terminée" : "Planifiée"}
                      </span>
                      <button onClick={() => copyLink(selectedRoom.roomName)} style={{ padding: "6px 14px", background: "white", color: "#0065b1", border: "1px solid #0065b1", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Copier le lien</button>
                      <button onClick={() => startMeeting(selectedRoom)} style={{ padding: "6px 16px", background: "#0065b1", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>▶ Démarrer</button>
                    </div>
                  </div>

                  {/* Subtabs */}
                  <div style={{ display: "flex", borderBottom: "1px solid #f0f7ff", padding: "0 20px" }}>
                    {[{ key: "enroll", label: "Participants" }, { key: "settings", label: "Paramètres" }].map(t => (
                      <button key={t.key} onClick={() => setRoomSubTab(t.key as any)}
                        style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${roomSubTab === t.key ? "#0065b1" : "transparent"}`, color: roomSubTab === t.key ? "#0065b1" : "#9ca3af", fontSize: 14, fontWeight: roomSubTab === t.key ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {roomSubTab === "enroll" && <EnrollPanel sessionId={selectedRoom.id} />}

                  {roomSubTab === "settings" && (
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { label: "Identifiant", value: selectedRoom.roomName, mono: true },
                        { label: "Lien spectateur", value: `/watch/${selectedRoom.roomName}`, mono: true },
                        { label: "Chat", value: selectedRoom.chatEnabled ? "Activé" : "Désactivé" },
                        { label: "Participation", value: selectedRoom.participationEnabled ? "Activée" : "Désactivée" },
                        { label: "Créée le", value: new Date(selectedRoom.createdAt).toLocaleDateString("fr-FR") },
                      ].map(row => (
                        <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f0f7ff", fontSize: 14, color: "#374151" }}>
                          <span style={{ color: "#6b7280" }}>{row.label}</span>
                          {row.mono ? <code style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: 5, fontSize: 13 }}>{row.value}</code> : <span style={{ fontWeight: 500 }}>{row.value}</span>}
                        </div>
                      ))}
                      <button disabled={deleting === selectedRoom.id} onClick={() => deleteRoom(selectedRoom.id)}
                        style={{ padding: "8px 18px", background: "white", color: "#e53e3e", border: "1px solid #e53e3e", borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 8, alignSelf: "flex-start", opacity: deleting === selectedRoom.id ? .5 : 1 }}>
                        {deleting === selectedRoom.id ? "Suppression…" : "Supprimer la salle"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Liste des salles */
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Toutes mes salles</span>
                    <span style={{ background: "#e8f4ff", color: "#0065b1", fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{rooms.length}</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fbff" }}>
                        {["Salle", "Enrôlés", "Enregistrements", "Statut", "Actions"].map(h => (
                          <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #f0f7ff" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map(room => (
                        <tr key={room.id} style={{ borderBottom: "1px solid #f0f7ff", cursor: "pointer" }} onClick={() => setSelectedRoom(room)}>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{room.title}</div>
                            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{new Date(room.createdAt).toLocaleDateString("fr-FR")}</div>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 14, color: "#374151" }}>{room.enrollments}</td>
                          <td style={{ padding: "12px 16px", fontSize: 14, color: "#374151" }}>{room.recordings}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: room.status === "LIVE" ? "#dcfce7" : "#f1f5f9", color: room.status === "LIVE" ? "#166534" : "#6b7280" }}>
                              {room.status === "LIVE" ? "● En direct" : room.status === "ENDED" ? "Terminée" : "Planifiée"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => startMeeting(room)} style={{ padding: "5px 12px", background: "#0065b1", color: "white", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>▶ Démarrer</button>
                              <button onClick={() => { setSelectedRoom(room); setRoomSubTab("enroll") }} style={{ padding: "5px 12px", background: "white", color: "#0065b1", border: "1px solid #0065b1", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Gérer</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── ENREGISTREMENTS ── */}
          {nav === "recordings" && (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Enregistrements de mes salles</span>
                <span style={{ background: "#e8f4ff", color: "#0065b1", fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{recordings.length}</span>
              </div>
              {loading
                ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "30px 20px", color: "#9ca3af", fontSize: 14 }}><span style={{ width: 14, height: 14, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "mod-spin .7s linear infinite", display: "inline-block" }} />Chargement…</div>
                : recordings.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Aucun enregistrement disponible</div>
                  : (
                    <>
                      {pagedRecs.map(rec => (
                        <div key={rec.id} style={{ borderBottom: "1px solid #f0f7ff" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#e8f4ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0065b1" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.filename}</div>
                              <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13, color: "#9ca3af" }}>🏠 {rec.session.title}</span>
                                {rec.duration != null && <span style={{ fontSize: 13, color: "#9ca3af" }}>⏱ {formatDuration(rec.duration)}</span>}
                                {rec.size != null && <span style={{ fontSize: 13, color: "#9ca3af" }}>💾 {formatSize(rec.size)}</span>}
                                <span style={{ fontSize: 13, color: "#9ca3af" }}>{new Date(rec.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              <button onClick={() => setPlayingKey(playingKey === rec.s3Key ? null : rec.s3Key)}
                                style={{ padding: "5px 12px", background: "#0065b1", color: "white", border: "none", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                                {playingKey === rec.s3Key ? "✖ Fermer" : "▶ Voir"}
                              </button>
                              <a href={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`} target="_blank" rel="noopener noreferrer"
                                style={{ padding: "5px 12px", background: "white", color: "#2fb344", border: "1px solid #2fb344", borderRadius: 7, fontSize: 13, textDecoration: "none", fontFamily: "inherit" }}>⬇ Télécharger</a>
                            </div>
                          </div>
                          {playingKey === rec.s3Key && (
                            <div style={{ padding: "0 16px 14px" }}>
                              <video controls autoPlay src={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`} style={{ width: "100%", maxHeight: 400, borderRadius: 8, background: "#000", display: "block" }}>
                                Votre navigateur ne supporte pas la lecture vidéo.
                              </video>
                            </div>
                          )}
                        </div>
                      ))}
                      <Pagination total={recordings.length} page={recPage} onPage={setRecPage} />
                    </>
                  )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: "white", borderTop: "1px solid #e2e8f0", padding: "10px 24px", textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontSize: 12, color: "#6b7280" }}>Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#0065b1" }}>Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
          <p style={{ fontSize: 11, color: "#9ca3af" }}>© DITSI – UN-CHK – 2026</p>
        </div>
      </div>

      {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={() => { fetchRooms(); setShowCreate(false) }} />}

      <style>{`
        @keyframes mod-spin { to { transform: rotate(360deg) } }
        @keyframes ep-progress { 0% { transform: translateX(-150%) } 100% { transform: translateX(350%) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f8fafd; }
        ::-webkit-scrollbar-thumb { background: #d1e4f5; border-radius: 3px; }
      `}</style>
    </div>
  )
}
