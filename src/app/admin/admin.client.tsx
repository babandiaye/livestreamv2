"use client"

import { useState, useEffect, useCallback } from "react"
import { signOut } from "next-auth/react"
import StatusPanel from "@/components/StatusPanel"

type User = { id: string; name: string; email: string; role: string; sessionCount: number; createdAt: string }
type Room = { id: string; title: string; roomName: string; status: string; createdAt: string; creator: { name: string; email: string }; enrollments: number; recordings: number }
type Recording = { id: string; filename: string; s3Key: string; duration: number | null; size: number | null; createdAt: string; status?: string; session: { id: string; title: string; roomName: string; creator: { name: string; email: string } } }
type EnrolledUser = { id: string; userId: string; name: string; email: string; role: string; enrolledAt: string }
type SearchUser = { id: string; name: string; email: string; role: string }
type ImportResult = { summary: { total: number; created: number; enrolled: number; skipped: number }; skipped: string[] }

const PAGE_SIZE = 50

function formatSize(b: number) {
  if (!b) return "—"
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  if (b < 1024 ** 3) return `${(b / (1024 * 1024)).toFixed(1)} Mo`
  return `${(b / 1024 ** 3).toFixed(2)} Go`
}
function formatDur(s: number) {
  if (!s) return "—"
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}m` : `${m}:${sc.toString().padStart(2, "0")}`
}
const ROLE_LABELS: Record<string, string> = { ADMIN: "Administrateur", MODERATOR: "Modérateur", VIEWER: "Spectateur" }

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

function Avatar({ name, color = "#0065b1" }: { name: string; color?: string }) {
  const bg = color
  return (
    <div style={{ width: 28, height: 28, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 500, color: "white", flexShrink: 0 }}>
      {initials(name || "?")}
    </div>
  )
}

function Pagination({ total, page, onPage }: { total: number; page: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE)
  if (pages <= 1) return null
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #f0f7ff", background: "#f8fbff" }}>
      <span style={{ fontSize: 14, color: "#6b7280" }}>
        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} sur {total}
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "white", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? .4 : 1, fontSize: 14 }}>←</button>
        {Array.from({ length: pages }, (_, i) => i + 1).filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1).map((p, i, arr) => (
          <>
            {i > 0 && arr[i - 1] !== p - 1 && <span key={`e${p}`} style={{ padding: "4px 6px", fontSize: 14, color: "#9ca3af" }}>…</span>}
            <button key={p} onClick={() => onPage(p)} style={{ padding: "4px 10px", border: "1px solid", borderColor: p === page ? "#0065b1" : "#e2e8f0", borderRadius: 6, background: p === page ? "#0065b1" : "white", color: p === page ? "white" : "#374151", cursor: "pointer", fontSize: 14, fontWeight: p === page ? 600 : 400 }}>{p}</button>
          </>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page === pages} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "white", cursor: page === pages ? "not-allowed" : "pointer", opacity: page === pages ? .4 : 1, fontSize: 14 }}>→</button>
      </div>
    </div>
  )
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
  const [enrollPage, setEnrollPage] = useState(1)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvDrag, setCsvDrag] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult, setCsvResult] = useState<ImportResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)

  const fetchEnrolled = useCallback(async () => {
    setLoadingList(true)
    const d = await (await fetch(`/api/admin/rooms/${sessionId}/enroll`)).json()
    setEnrolled(d.enrollments ?? [])
    setEnrollPage(1)
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
    await fetch(`/api/admin/rooms/${sessionId}/enroll`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
    setQuery(""); setResults([])
    await fetchEnrolled(); setAdding(null)
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

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #f0f7ff", padding: "0 16px", gap: 0 }}>
        {(["manual", "csv"] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${subTab === t ? "#0065b1" : "transparent"}`, color: subTab === t ? "#0065b1" : "#9ca3af", fontSize: 14, fontWeight: subTab === t ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
            {t === "manual" ? "Individuel" : "Import CSV"}
          </button>
        ))}
      </div>

      {subTab === "manual" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f0f7ff" }}>
            <input placeholder="Rechercher un utilisateur…" value={query} onChange={e => setQuery(e.target.value)}
              style={{ flex: 1, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 14, fontFamily: "inherit", outline: "none", color: "#1a1a2e", background: "#f8fbff" }} />
            {searching && <span style={{ width: 13, height: 13, border: "2px solid #d1e4f5", borderTopColor: "#0065b1", borderRadius: "50%", animation: "adm-spin .7s linear infinite", display: "inline-block", flexShrink: 0 }} />}
          </div>
          {results.length > 0 && (
            <div style={{ background: "#f8fbff", borderBottom: "1px solid #f0f7ff" }}>
              {results.map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #f0f7ff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={u.name} color="#0065b1" />
                    <div><div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{u.name}</div><div style={{ fontSize: 13, color: "#9ca3af" }}>{u.email}</div></div>
                  </div>
                  <button disabled={adding === u.id} onClick={() => enroll(u.id)}
                    style={{ padding: "4px 12px", background: "#0065b1", color: "white", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: adding === u.id ? .5 : 1 }}>
                    {adding === u.id ? "…" : "+ Ajouter"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {subTab === "csv" && !csvResult && (
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #f0f7ff", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.6 }}>
              Colonnes : <code style={{ background: "#e8f4ff", color: "#0065b1", padding: "1px 4px", borderRadius: 3 }}>email</code> · <code style={{ background: "#e8f4ff", color: "#0065b1", padding: "1px 4px", borderRadius: 3 }}>email,prenom,nom</code><br />
              Jusqu&apos;à <strong style={{ color: "#374151" }}>10 000 utilisateurs</strong>. Créés automatiquement si inexistants.
            </div>
            <a href="/api/admin/enroll-csv-template" download style={{ fontSize: 14, color: "#0065b1", textDecoration: "none", fontWeight: 600, padding: "4px 10px", border: "1px solid #0065b1", borderRadius: 6, whiteSpace: "nowrap" }}>⬇ Modèle CSV</a>
          </div>
          <div
            onClick={() => document.getElementById("csv-input-adm")?.click()}
            onDragOver={e => { e.preventDefault(); setCsvDrag(true) }}
            onDragLeave={() => setCsvDrag(false)}
            onDrop={e => { e.preventDefault(); setCsvDrag(false); const f = e.dataTransfer.files[0]; if (f) setCsvFile(f) }}
            style={{ border: `2px dashed ${csvDrag ? "#0065b1" : csvFile ? "#2fb344" : "#d1e4f5"}`, background: csvFile ? "#f0fdf4" : csvDrag ? "#f0f7ff" : "white", borderRadius: 8, padding: "20px", textAlign: "center", cursor: "pointer" }}>
            <input id="csv-input-adm" type="file" accept=".csv" style={{ display: "none" }} onChange={e => e.target.files?.[0] && setCsvFile(e.target.files[0])} />
            {csvFile ? <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>📄 {csvFile.name}</span> : <span style={{ fontSize: 14, color: "#9ca3af" }}>Glisser un fichier CSV ici ou cliquer</span>}
          </div>
          {csvError && <div style={{ fontSize: 13, color: "#b91c1c", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 10px" }}>⚠️ {csvError}</div>}
          {csvLoading && <div style={{ height: 4, background: "#e8f4ff", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: "40%", background: "#0065b1", borderRadius: 2, animation: "ep-progress 1.4s ease-in-out infinite" }} /></div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {csvFile && !csvLoading && <button onClick={() => setCsvFile(null)} style={{ padding: "5px 12px", background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>}
            <button onClick={submitCsv} disabled={!csvFile || csvLoading} style={{ padding: "5px 14px", background: "#0065b1", color: "white", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: !csvFile || csvLoading ? .5 : 1 }}>
              {csvLoading ? "Import en cours…" : "Importer"}
            </button>
          </div>
        </div>
      )}

      {subTab === "csv" && csvResult && (
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #f0f7ff", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "8px 12px", fontSize: 14, fontWeight: 600, color: "#2fb344" }}>✅ Import terminé</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[{ v: csvResult.summary.total, l: "lus", bg: "#f8fbff", c: "#0065b1" }, { v: csvResult.summary.created, l: "créés", bg: "#eff6ff", c: "#3b82f6" }, { v: csvResult.summary.enrolled, l: "enrôlés", bg: "#f0fdf4", c: "#2fb344" }, { v: csvResult.summary.skipped, l: "déjà enrôlés", bg: "#fffbeb", c: "#d97706" }].map(s => (
              <div key={s.l} style={{ background: s.bg, borderRadius: 7, padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 20, fontWeight: 600, color: s.c }}>{s.v}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: s.c }}>{s.l}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { setCsvResult(null); setCsvFile(null) }} style={{ padding: "5px 12px", background: "white", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>↩ Nouvel import</button>
        </div>
      )}

      {/* Liste enrôlés */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "#f8fbff", borderBottom: "1px solid #f0f7ff", borderTop: "1px solid #f0f7ff" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>Utilisateurs enrôlés</span>
        <span style={{ background: "#e8f4ff", color: "#0065b1", fontSize: 14, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{enrolled.length}</span>
      </div>
      {loadingList
        ? <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "20px 14px", color: "#9ca3af", fontSize: 14 }}><span style={{ width: 13, height: 13, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "adm-spin .7s linear infinite", display: "inline-block" }} /> Chargement…</div>
        : enrolled.length === 0
          ? <div style={{ padding: "20px 14px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Aucun utilisateur enrôlé</div>
          : pagedEnrolled.map(u => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid #f0f7ff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={u.name} color="#0065b1" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{u.name}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>{u.email}</div>
                  <div style={{ fontSize: 14, color: "#c4cdd9" }}>Enrôlé le {new Date(u.enrolledAt).toLocaleDateString("fr-FR")}</div>
                </div>
              </div>
              <button disabled={removing === u.userId} onClick={() => unenroll(u.userId)}
                style={{ padding: "3px 10px", background: "white", color: "#e53e3e", border: "1px solid #e53e3e", borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: removing === u.userId ? .5 : 1 }}>
                {removing === u.userId ? "…" : "Retirer"}
              </button>
            </div>
          ))
      }
      <Pagination total={enrolled.length} page={enrollPage} onPage={setEnrollPage} />
    </div>
  )
}

// ── Page principale ──
export default function AdminClient({ user }: { user: { name?: string | null; email?: string | null; role: string } }) {
  const [nav, setNav] = useState<"rooms" | "users" | "recordings" | "status">("rooms")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [deletingRec, setDeletingRec] = useState<string | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [userPage, setUserPage] = useState(1)
  const [recPage, setRecPage] = useState(1)
  const [userSearch, setUserSearch] = useState("")

  const fetchUsers = useCallback(async () => { setLoading(true); const d = await (await fetch("/api/admin/users")).json(); setUsers(d.users ?? []); setUserPage(1); setLoading(false) }, [])
  const fetchRooms = useCallback(async () => { setLoading(true); const d = await (await fetch("/api/admin/rooms")).json(); setRooms(d.rooms ?? []); setLoading(false) }, [])
  const fetchRecordings = useCallback(async () => { setLoading(true); const d = await (await fetch("/api/recordings/me")).json(); setRecordings(d.recordings ?? []); setRecPage(1); setLoading(false) }, [])

  useEffect(() => {
    if (nav === "users") fetchUsers()
    if (nav === "rooms") fetchRooms()
    if (nav === "recordings") fetchRecordings()
  }, [nav, fetchUsers, fetchRooms, fetchRecordings])

  const changeRole = async (userId: string, role: string) => {
    setUpdatingRole(userId)
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }) })
    await fetchUsers(); setUpdatingRole(null)
  }

  const startMeeting = async (room: Room) => {
    const res = await fetch("/api/create_stream", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room_name: room.roomName,
        metadata: { creator_identity: user.name ?? user.email ?? "Admin", enable_chat: true, allow_participation: false },
      }),
    })
    if (!res.ok) { alert("Erreur démarrage"); return }
    const data = await res.json()
    window.location.href = `/host?at=${data.auth_token}&rt=${data.connection_details.token}`
  }

  const deleteRoom = async (id: string) => {
    if (!confirm("Supprimer cette salle ?")) return
    await fetch(`/api/rooms/${id}`, { method: "DELETE" })
    await fetchRooms()
    setSelectedRoom(null)
  }

  const copyLink = (roomName: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/watch/${roomName}`)
    alert("Lien copié !")
  }

  const deleteRecording = async (id: string, filename: string) => {
    if (!confirm(`Supprimer "${filename}" ?`)) return
    setDeletingRec(id)
    await fetch("/api/admin/recordings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, deleteFromS3: true }) })
    await fetchRecordings(); setDeletingRec(null)
  }

  const filteredUsers = users.filter(u =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
  )
  const pagedUsers = filteredUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE)
  const pagedRecs = recordings.slice((recPage - 1) * PAGE_SIZE, recPage * PAGE_SIZE)

  const userName = user.name ?? user.email ?? "Admin"

  const navItems = [
    { key: "rooms", label: "Salles", count: rooms.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.259a1 1 0 01-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg> },
    { key: "recordings", label: "Enregistrements", count: recordings.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg> },
    ...(user.role === "ADMIN" ? [{ key: "users", label: "Utilisateurs", count: users.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }] : []),
    ...(user.role === "ADMIN" ? [{ key: "status", label: "Statut", count: 0, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> }] : []),
  ]

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Google Sans','Segoe UI',system-ui,sans-serif", color: "#1a1a2e", background: "#f8fafd", position: "relative" }}>

      {/* ── OVERLAY mobile ── */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 40 }} />
      )}

      {/* ── SIDEBAR ── */}
      <div style={{ width: 210, flexShrink: 0, background: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform .25s ease" }} className="adm-sidebar-mobile">
        {/* Logo */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="/logo-unchk.png" alt="UN-CHK" style={{ height: "36px", objectFit: "contain", maxWidth: "160px" }} />
        </div>

        {/* Nav */}
        <div style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#9ca3af", padding: "6px 8px 2px", textTransform: "uppercase", letterSpacing: ".05em" }}>Administration</div>
          {navItems.map(item => (
            <button key={item.key} onClick={() => setNav(item.key as any)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, border: "none", background: nav === item.key ? "#e8f4ff" : "none", color: nav === item.key ? "#0065b1" : "#6b7280", cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: nav === item.key ? 600 : 400, textAlign: "left", width: "100%" }}>
              {item.icon}
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.count > 0 && (
                <span style={{ background: nav === item.key ? "#0065b1" : "#f0f7ff", color: nav === item.key ? "white" : "#0065b1", fontSize: 14, padding: "1px 5px", borderRadius: 10, fontWeight: 600 }}>{item.count}</span>
              )}
            </button>
          ))}

          {/* Salles liste rapide */}
          {nav === "rooms" && rooms.length > 0 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#9ca3af", padding: "10px 8px 2px", textTransform: "uppercase", letterSpacing: ".05em" }}>Salles</div>
              {rooms.slice(0, 8).map(room => (
                <button key={room.id} onClick={() => setSelectedRoom(room)}
                  style={{ display: "flex", flexDirection: "column", padding: "6px 8px", borderRadius: 7, border: "none", background: selectedRoom?.id === room.id ? "#e8f4ff" : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: selectedRoom?.id === room.id ? "#0065b1" : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.title}</span>
                  <span style={{ fontSize: 14, color: "#9ca3af", marginTop: 1 }}>{room.enrollments} enrôlé{room.enrollments > 1 ? "s" : ""}{room.recordings > 0 ? ` · ${room.recordings} enreg.` : ""}</span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Profil */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid #f0f7ff", display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={userName} color="#0065b1" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName}</div>
            <div style={{ fontSize: 14, color: "#0065b1" }}>{ROLE_LABELS[user.role] ?? user.role}</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/" })} title="Déconnexion"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#e53e3e", padding: 4, borderRadius: 5, display: "flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", marginLeft: "210px" }} className="adm-main-content">

        {/* Header contextuel */}
        <div style={{ padding: "0 16px", height: 60, background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          {/* Bouton hamburger mobile */}
          <button onClick={() => setSidebarOpen(true)} className="adm-hamburger" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, display: "none", marginRight: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
              {nav === "rooms" ? "Salles" : nav === "users" ? "Utilisateurs" : nav === "status" ? "Statut des services" : "Enregistrements"}
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              {nav === "rooms" ? "Gérez les salles et les participants" : nav === "users" ? "Gérez les rôles et accès" : nav === "status" ? "Vérifiez la connectivité de l'infrastructure" : "Tous les enregistrements"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {rooms.some(r => r.status === "LIVE") && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#dcfce7", color: "#166534", fontSize: 14, padding: "4px 10px", borderRadius: 20 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                {rooms.filter(r => r.status === "LIVE").length} en direct
              </div>
            )}
            <a href="/" style={{ fontSize: 14, padding: "6px 14px", background: "white", color: "#0065b1", border: "1px solid #0065b1", borderRadius: 7, textDecoration: "none", fontWeight: 500 }}>← Accueil</a>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>

          {/* ── SALLES ── */}
          {nav === "rooms" && (
            <>
              {/* Stats cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Salles", value: rooms.length, sub: `${rooms.filter(r => r.status === "LIVE").length} en direct`, color: "#0065b1" },
                  { label: "Total enrôlés", value: rooms.reduce((a, r) => a + r.enrollments, 0), sub: "tous types", color: "#2fb344" },
                  { label: "Enregistrements", value: rooms.reduce((a, r) => a + r.recordings, 0), sub: "stockés S3", color: "#d97706" },
                  { label: "Sessions actives", value: rooms.filter(r => r.status === "LIVE").length, sub: "en ce moment", color: "#e53e3e" },
                ].map(c => (
                  <div key={c.label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 600, color: c.color }}>{c.value}</div>
                    <div style={{ fontSize: 14, color: "#9ca3af", marginTop: 3 }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Layout salles */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                {/* Liste salles */}
                <div style={{ width: 260, flexShrink: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Salles</span>
                    <span style={{ background: "#e8f4ff", color: "#0065b1", fontSize: 14, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{rooms.length}</span>
                  </div>
                  {loading ? <div style={{ padding: "20px 14px", color: "#9ca3af", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 13, height: 13, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "adm-spin .7s linear infinite", display: "inline-block" }} />Chargement…</div>
                    : rooms.length === 0 ? <div style={{ padding: "20px 14px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>Aucune salle</div>
                      : rooms.map(room => (
                        <div key={room.id} onClick={() => setSelectedRoom(room)}
                          style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f0f7ff", borderLeft: `3px solid ${selectedRoom?.id === room.id ? "#0065b1" : "transparent"}`, background: selectedRoom?.id === room.id ? "#e8f4ff" : "white", transition: "background .12s" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.title}</span>
                            {room.status === "LIVE" && <span style={{ fontSize: 9, fontWeight: 700, color: "#2fb344", flexShrink: 0 }}>● LIVE</span>}
                          </div>
                          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
                            {room.creator.name} · {room.enrollments} enrôlé{room.enrollments > 1 ? "s" : ""}
                            {room.recordings > 0 ? ` · ${room.recordings} enreg.` : ""}
                          </div>
                        </div>
                      ))}
                </div>

                {/* Panel salle sélectionnée */}
                <div style={{ flex: 1, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", minWidth: 0 }}>
                  {selectedRoom ? (
                    <>
                      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{selectedRoom.title}</div>
                          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>Créé par {selectedRoom.creator.name}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 13, fontWeight: 600, background: selectedRoom.status === "LIVE" ? "#dcfce7" : "#f1f5f9", color: selectedRoom.status === "LIVE" ? "#166534" : "#6b7280" }}>
                            {selectedRoom.status === "LIVE" ? "● En direct" : selectedRoom.status === "ENDED" ? "Terminée" : "Planifiée"}
                          </span>
                          <button onClick={() => copyLink(selectedRoom.roomName)}
                            style={{ padding: "5px 12px", background: "white", color: "#0065b1", border: "1px solid #0065b1", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                            Copier le lien
                          </button>
                          <button onClick={() => startMeeting(selectedRoom)}
                            style={{ padding: "5px 14px", background: "#0065b1", color: "white", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                            ▶ Démarrer
                          </button>
                          <button onClick={() => deleteRoom(selectedRoom.id)}
                            style={{ padding: "5px 12px", background: "white", color: "#e53e3e", border: "1px solid #e53e3e", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                            Supprimer
                          </button>
                        </div>
                      </div>
                      <EnrollPanel sessionId={selectedRoom.id} sessionTitle={selectedRoom.title} />
                    </>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, color: "#9ca3af", gap: 8 }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.259a1 1 0 01-1.447.894L15 14"/><rect x="3" y="6" width="12" height="12" rx="2"/></svg>
                      <span style={{ fontSize: 15 }}>Sélectionnez une salle</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── UTILISATEURS ── */}
          {nav === "users" && user.role === "ADMIN" && (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Utilisateurs</span>
                  <span style={{ background: "#e8f4ff", color: "#0065b1", fontSize: 14, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{filteredUsers.length}</span>
                </div>
                <input placeholder="Rechercher par nom ou email…" value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1) }}
                  style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 14, fontFamily: "inherit", outline: "none", color: "#1a1a2e", width: 240, background: "#f8fbff" }} />
              </div>
              {loading
                ? <div style={{ padding: "30px 20px", color: "#9ca3af", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 14, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "adm-spin .7s linear infinite", display: "inline-block" }} />Chargement…</div>
                : (
                  <>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f8fbff" }}>
                            {["Utilisateur", "Email", "Rôle", "Salles", "Inscrit le", "Changer le rôle"].map(h => (
                              <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #f0f7ff", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedUsers.map(u => (
                            <tr key={u.id} style={{ borderBottom: "1px solid #f0f7ff" }}>
                              <td style={{ padding: "10px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <Avatar name={u.name} color={u.role === "ADMIN" ? "#e53e3e" : u.role === "MODERATOR" ? "#0065b1" : "#6b7280"} />
                                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{u.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: "10px 16px", fontSize: 14, color: "#6b7280" }}>{u.email}</td>
                              <td style={{ padding: "10px 16px" }}>
                                <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 14, fontWeight: 600, background: u.role === "ADMIN" ? "#fee2e2" : u.role === "MODERATOR" ? "#dbeafe" : "#f3f4f6", color: u.role === "ADMIN" ? "#b91c1c" : u.role === "MODERATOR" ? "#1e40af" : "#374151" }}>
                                  {ROLE_LABELS[u.role] ?? u.role}
                                </span>
                              </td>
                              <td style={{ padding: "10px 16px", fontSize: 14, color: "#6b7280", textAlign: "center" }}>{u.sessionCount}</td>
                              <td style={{ padding: "10px 16px", fontSize: 14, color: "#6b7280" }}>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                              <td style={{ padding: "10px 16px" }}>
                                <select value={u.role} disabled={updatingRole === u.id} onChange={e => changeRole(u.id, e.target.value)}
                                  style={{ padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, color: "#1a1a2e", fontFamily: "inherit", cursor: "pointer", background: "white" }}>
                                  <option value="VIEWER">Spectateur</option>
                                  <option value="MODERATOR">Modérateur</option>
                                  <option value="ADMIN">Administrateur</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination total={filteredUsers.length} page={userPage} onPage={setUserPage} />
                  </>
                )}
            </div>
          )}

          {/* ── ENREGISTREMENTS ── */}
          {nav === "recordings" && (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f7ff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Enregistrements</span>
                <span style={{ background: "#e8f4ff", color: "#0065b1", fontSize: 14, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>{recordings.length}</span>
              </div>
              {loading
                ? <div style={{ padding: "30px 20px", color: "#9ca3af", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 14, height: 14, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "adm-spin .7s linear infinite", display: "inline-block" }} />Chargement…</div>
                : recordings.length === 0 ? <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af", fontSize: 15 }}>Aucun enregistrement</div>
                  : (
                    <>
                      {pagedRecs.map(rec => (
                        <div key={rec.id} style={{ borderBottom: "1px solid #f0f7ff" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, background: "#e8f4ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0065b1" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/></svg>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.filename}</div>
                              <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13, color: "#9ca3af" }}>🏠 {rec.session.title}</span>
                                <span style={{ fontSize: 13, color: "#9ca3af" }}>👤 {rec.session.creator.name}</span>
                                {rec.duration != null && <span style={{ fontSize: 13, color: "#9ca3af" }}>⏱ {formatDur(rec.duration)}</span>}
                                {rec.size != null && <span style={{ fontSize: 13, color: "#9ca3af" }}>💾 {formatSize(rec.size)}</span>}
                                <span style={{ fontSize: 13, color: "#9ca3af" }}>{new Date(rec.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              {rec.status !== "PROCESSING" && rec.status !== "FAILED" && <>
                                <button onClick={() => setPlayingKey(playingKey === rec.s3Key ? null : rec.s3Key)}
                                  style={{ padding: "5px 12px", background: "#0065b1", color: "white", border: "none", borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                                  {playingKey === rec.s3Key ? "✖ Fermer" : "▶ Voir"}
                                </button>
                                <a href={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`} target="_blank" rel="noopener noreferrer"
                                  style={{ padding: "5px 12px", background: "white", color: "#2fb344", border: "1px solid #2fb344", borderRadius: 6, fontSize: 14, textDecoration: "none", fontFamily: "inherit" }}>⬇</a>
                              </>}
                              {user.role === "ADMIN" && (
                                <button disabled={deletingRec === rec.id} onClick={() => deleteRecording(rec.id, rec.filename)}
                                  style={{ padding: "5px 10px", background: "white", color: "#e53e3e", border: "1px solid #e53e3e", borderRadius: 6, fontSize: 14, cursor: "pointer", fontFamily: "inherit", opacity: deletingRec === rec.id ? .5 : 1 }}>
                                  {deletingRec === rec.id ? "…" : "🗑"}
                                </button>
                              )}
                            </div>
                          </div>
                          {playingKey === rec.s3Key && (
                            <div style={{ padding: "0 16px 14px" }}>
                              <video controls autoPlay src={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`} style={{ width: "100%", maxHeight: 420, borderRadius: 8, background: "#000", display: "block" }}>
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

          {/* ── STATUT DES SERVICES ── */}
          {nav === "status" && <StatusPanel />}
        </div>

        {/* Footer */}
        <div style={{ background: "white", borderTop: "1px solid #e2e8f0", padding: "12px 24px", textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontSize: 13, color: "#6b7280" }}>Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#0065b1" }}>Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>© DITSI – UN-CHK – 2026</p>
        </div>
      </div>

      <style>{`
        @keyframes adm-spin { to { transform: rotate(360deg) } }
        @keyframes ep-progress { 0% { transform: translateX(-150%) } 100% { transform: translateX(350%) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f8fafd; }
        ::-webkit-scrollbar-thumb { background: #d1e4f5; border-radius: 3px; }
        @media (max-width: 768px) {
          .adm-sidebar-mobile { transform: translateX(-100%) !important; }
          .adm-sidebar-mobile.open { transform: translateX(0) !important; }
          .adm-hamburger { display: flex !important; }
          .adm-main-content { margin-left: 0 !important; }
        }
        @media (min-width: 769px) {
          .adm-sidebar-mobile { transform: translateX(0) !important; position: relative !important; }
          .adm-main-content { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  )
}
