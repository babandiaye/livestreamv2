"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { signOut } from "next-auth/react"

type User = { id: string; name: string; email: string; role: string; sessionCount: number; createdAt: string }
type Room  = { id: string; title: string; roomName: string; status: string; createdAt: string; creator: { name: string; email: string }; enrollments: number; recordings: number }
type Recording = {
  id: string; filename: string; s3Key: string; duration: number | null
  size: number | null; createdAt: string
  session: { id: string; title: string; roomName: string; creator: { name: string; email: string } }
}
type EnrolledUser = { id: string; name: string; email: string; role: string; enrolledAt: string }
type SearchUser   = { id: string; name: string; email: string; role: string }
type ImportResult = { summary: { total: number; enrolled: number; skipped: number; notFound: number }; notFound: string[]; skipped: string[] }

function formatSize(b: number) {
  if (!b) return "—"
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  if (b < 1024 ** 3) return `${(b / (1024 * 1024)).toFixed(1)} Mo`
  return `${(b / 1024 ** 3).toFixed(2)} Go`
}
function formatDur(s: number) {
  if (!s) return "—"
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60
  return h > 0 ? `${h}h${m.toString().padStart(2,"0")}m` : `${m}:${sc.toString().padStart(2,"0")}`
}
const ROLE_LABELS: Record<string, string> = { ADMIN:"Administrateur", MODERATOR:"Modérateur", VIEWER:"Spectateur" }

// ── EnrollPanel ──
function EnrollPanel({ sessionId, sessionTitle }: { sessionId: string; sessionTitle: string }) {
  const [subTab, setSubTab]       = useState<"manual"|"csv">("manual")
  const [enrolled, setEnrolled]   = useState<EnrolledUser[]>([])
  const [query, setQuery]         = useState("")
  const [results, setResults]     = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding]       = useState<string|null>(null)
  const [removing, setRemoving]   = useState<string|null>(null)
  const [loadingList, setLoadingList] = useState(true)
  // CSV
  const [csvFile, setCsvFile]     = useState<File|null>(null)
  const [csvDrag, setCsvDrag]     = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvResult, setCsvResult] = useState<ImportResult|null>(null)
  const [csvError, setCsvError]   = useState<string|null>(null)

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
      const res  = await fetch(`/api/admin/rooms/${sessionId}/enroll-csv`, { method: "POST", body: fd })
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
          <button className={`ep-tab${subTab==="manual"?" active":""}`} onClick={() => setSubTab("manual")}>Individuel</button>
          <button className={`ep-tab${subTab==="csv"?" active":""}`} onClick={() => setSubTab("csv")}>Import CSV</button>
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
                  <div className="ep-uinfo"><span className="ep-uname">{u.name}</span><span className="ep-uemail">{u.email}</span></div>
                  <button className="adm-btn adm-btn-primary ep-sm" disabled={adding===u.id} onClick={() => enroll(u.id)}>{adding===u.id?"…":"+ Ajouter"}</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {subTab === "csv" && !csvResult && (
        <div className="ep-csv">
          <div className="ep-csv-info">Colonnes : <code>email</code> · <code>email,nom</code> · <code>email,prenom,nom</code> — séparateur <code>,</code> ou <code>;</code></div>
          <div className={`ep-dropzone${csvDrag?" drag":""}${csvFile?" ok":""}`}
            onDragOver={e => { e.preventDefault(); setCsvDrag(true) }}
            onDragLeave={() => setCsvDrag(false)}
            onDrop={e => { e.preventDefault(); setCsvDrag(false); const f=e.dataTransfer.files[0]; if(f) setCsvFile(f) }}
            onClick={() => document.getElementById("csv-input")?.click()}>
            <input id="csv-input" type="file" accept=".csv" style={{ display:"none" }} onChange={e => e.target.files?.[0] && setCsvFile(e.target.files[0])} />
            {csvFile ? <span className="ep-fname">📄 {csvFile.name}</span> : <span className="ep-hint">⬆ Glisser un fichier CSV ou cliquer</span>}
          </div>
          {csvError && <div className="ep-csv-err">{csvError}</div>}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:8 }}>
            {csvFile && <button className="adm-btn adm-btn-outline" onClick={() => setCsvFile(null)} disabled={csvLoading}>Annuler</button>}
            <button className="adm-btn adm-btn-primary" onClick={submitCsv} disabled={!csvFile||csvLoading}>
              {csvLoading ? <><span className="ep-spinner" /> Import…</> : "Importer"}
            </button>
          </div>
        </div>
      )}

      {subTab === "csv" && csvResult && (
        <div className="ep-csv">
          <div className="ep-csv-stats">
            {[{v:csvResult.summary.total,l:"lus",c:"total"},{v:csvResult.summary.enrolled,l:"enrôlés",c:"ok"},{v:csvResult.summary.skipped,l:"déjà enrôlés",c:"skip"},{v:csvResult.summary.notFound,l:"inconnus",c:"err"}].map(s => (
              <div key={s.l} className={`ep-stat ep-stat-${s.c}`}><span className="ep-sv">{s.v}</span><span className="ep-sl">{s.l}</span></div>
            ))}
          </div>
          {csvResult.notFound.length > 0 && (
            <div className="ep-csv-detail">
              <div className="ep-csv-dl-title">Non trouvés (pas encore connectés)</div>
              <div className="ep-chips">{csvResult.notFound.map(e => <span key={e} className="ep-chip ep-chip-err">{e}</span>)}</div>
            </div>
          )}
          <button className="adm-btn adm-btn-outline" style={{ marginTop:8 }} onClick={() => { setCsvResult(null); setCsvFile(null) }}>Nouvel import</button>
        </div>
      )}

      <div className="ep-list-header">
        <span>Utilisateurs enrôlés</span>
        <span className="adm-count">{enrolled.length}</span>
      </div>
      {loadingList ? <div className="adm-loading"><span className="adm-spinner" /> Chargement…</div>
      : enrolled.length === 0 ? <div className="adm-empty">Aucun utilisateur enrôlé</div>
      : enrolled.map(u => (
        <div key={u.id} className="ep-row">
          <div className="ep-uinfo">
            <span className="ep-uname">{u.name}</span>
            <span className="ep-uemail">{u.email}</span>
            <span className="ep-date">Enrôlé le {new Date(u.enrolledAt).toLocaleDateString("fr-FR")}</span>
          </div>
          <button className="adm-btn adm-btn-delete ep-sm" disabled={removing===u.id} onClick={() => unenroll(u.id)}>{removing===u.id?"…":"Retirer"}</button>
        </div>
      ))}

      <style>{`
        .ep-root{display:flex;flex-direction:column;}
        .ep-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #f0f7ff;gap:12px;flex-wrap:wrap;}
        .ep-title{font-size:0.9rem;font-weight:700;color:#1a1a2e;}
        .ep-tabs{display:flex;gap:4px;}
        .ep-tab{padding:5px 14px;border:1.5px solid #d1e4f5;background:white;border-radius:20px;font-size:0.78rem;font-weight:600;color:#6b7280;cursor:pointer;font-family:inherit;transition:all .15s;}
        .ep-tab.active{background:#0065b1;border-color:#0065b1;color:#fff;}
        .ep-search{display:flex;align-items:center;gap:8px;padding:12px 20px;border-bottom:1px solid #f0f7ff;}
        .ep-input{flex:1;padding:7px 11px;border:1.5px solid #d1e4f5;border-radius:7px;font-size:0.83rem;font-family:inherit;outline:none;color:#1a1a2e;}
        .ep-input:focus{border-color:#0065b1;}
        .ep-spinner{width:14px;height:14px;border:2px solid #d1e4f5;border-top-color:#0065b1;border-radius:50%;animation:adm-spin .7s linear infinite;flex-shrink:0;display:inline-block;}
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
        .ep-csv-info{font-size:0.72rem;color:#9ca3af;line-height:1.5;}
        .ep-csv-info code{font-family:monospace;font-size:0.76rem;background:#e8f4ff;padding:1px 4px;border-radius:3px;color:#0065b1;}
        .ep-dropzone{border:2px dashed #d1e4f5;border-radius:9px;padding:20px;text-align:center;cursor:pointer;transition:all .15s;}
        .ep-dropzone:hover,.ep-dropzone.drag{border-color:#0065b1;background:#f0f7ff;}
        .ep-dropzone.ok{border-color:#2fb344;background:#f0fdf4;}
        .ep-hint{font-size:0.82rem;color:#9ca3af;}
        .ep-fname{font-size:0.82rem;color:#1a1a2e;font-weight:600;}
        .ep-csv-err{font-size:0.78rem;color:#b91c1c;background:#fff0f0;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;}
        .ep-csv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
        .ep-stat{display:flex;flex-direction:column;align-items:center;padding:10px 6px;border-radius:7px;gap:3px;}
        .ep-sv{font-size:1.3rem;font-weight:700;}.ep-sl{font-size:0.68rem;font-weight:500;}
        .ep-stat-total{background:#f8fbff;}.ep-stat-total .ep-sv{color:#0065b1;}.ep-stat-total .ep-sl{color:#9ca3af;}
        .ep-stat-ok{background:#f0fdf4;}.ep-stat-ok .ep-sv{color:#2fb344;}.ep-stat-ok .ep-sl{color:#2fb344;}
        .ep-stat-skip{background:#fffbeb;}.ep-stat-skip .ep-sv{color:#d97706;}.ep-stat-skip .ep-sl{color:#d97706;}
        .ep-stat-err{background:#fff0f0;}.ep-stat-err .ep-sv{color:#b91c1c;}.ep-stat-err .ep-sl{color:#b91c1c;}
        .ep-csv-detail{background:#f8fbff;border:1px solid #e8f4ff;border-radius:7px;padding:10px;}
        .ep-csv-dl-title{font-size:0.76rem;font-weight:700;color:#1a1a2e;margin-bottom:6px;}
        .ep-chips{display:flex;flex-wrap:wrap;gap:5px;}
        .ep-chip{font-size:0.7rem;padding:2px 8px;border-radius:20px;font-weight:500;}
        .ep-chip-err{background:#fee2e2;color:#b91c1c;}
      `}</style>
    </div>
  )
}

// ── Page principale ──
export default function AdminClient({ user }: { user: { name?: string|null; email?: string|null; role: string } }) {
  const [tab, setTab]             = useState<"users"|"rooms"|"recordings">("rooms")
  const [users, setUsers]         = useState<User[]>([])
  const [rooms, setRooms]         = useState<Room[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading]     = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string|null>(null)
  const [deletingRec, setDeletingRec]   = useState<string|null>(null)
  const [playingKey, setPlayingKey]     = useState<string|null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room|null>(null)

  const fetchUsers      = useCallback(async () => { setLoading(true); const d = await (await fetch("/api/admin/users")).json(); setUsers(d.users??[]); setLoading(false) }, [])
  const fetchRooms      = useCallback(async () => { setLoading(true); const d = await (await fetch("/api/admin/rooms")).json(); setRooms(d.rooms??[]); setLoading(false) }, [])
  const fetchRecordings = useCallback(async () => { setLoading(true); const d = await (await fetch("/api/recordings/me")).json(); setRecordings(d.recordings??[]); setLoading(false) }, [])

  useEffect(() => {
    if (tab === "users")      fetchUsers()
    if (tab === "rooms")      fetchRooms()
    if (tab === "recordings") fetchRecordings()
  }, [tab, fetchUsers, fetchRooms, fetchRecordings])

  const changeRole = async (userId: string, role: string) => {
    setUpdatingRole(userId)
    await fetch("/api/admin/users", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ userId, role }) })
    await fetchUsers(); setUpdatingRole(null)
  }

  const deleteRecording = async (id: string, filename: string) => {
    if (!confirm(`Supprimer "${filename}" ?`)) return
    setDeletingRec(id)
    await fetch("/api/admin/recordings", { method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id, deleteFromS3: true }) })
    await fetchRecordings(); setDeletingRec(null)
  }

  return (
    <div className="adm-root">
      <header className="adm-header">
        <a href="/" className="adm-logo-link">
          <Image src="/logo-unchk.png" alt="UN-CHK" width={110} height={44} style={{ objectFit:"contain" }} priority />
        </a>
        <div className="adm-header-right">
          <span className="adm-username">{user.name ?? user.email}</span>
          <a href="/" className="adm-btn adm-btn-outline">← Tableau de bord</a>
          <button className="adm-btn adm-btn-danger" onClick={() => signOut({ callbackUrl:"/" })}>Déconnexion</button>
        </div>
      </header>

      <div className="adm-page-title">
        <h1>Administration</h1>
        <p>Gérez les salles, les utilisateurs et les enregistrements</p>
      </div>

      <div className="adm-tabs-wrap">
        <div className="adm-tabs">
          <button className={`adm-tab${tab==="rooms"?" active":""}`} onClick={() => setTab("rooms")}>
            Salles{rooms.length>0?` (${rooms.length})`:""}
          </button>
          {user.role === "ADMIN" && (
            <button className={`adm-tab${tab==="users"?" active":""}`} onClick={() => setTab("users")}>
              Utilisateurs{users.length>0?` (${users.length})`:""}
            </button>
          )}
          <button className={`adm-tab${tab==="recordings"?" active":""}`} onClick={() => setTab("recordings")}>
            Enregistrements{recordings.length>0?` (${recordings.length})`:""}
          </button>
        </div>
      </div>

      <main className="adm-main">

        {/* SALLES + ENRÔLEMENT */}
        {tab === "rooms" && (
          <div className="adm-rooms-layout">
            <div className="adm-card adm-rooms-list">
              <div className="adm-card-header">
                <span className="adm-card-title">Salles</span>
                <span className="adm-count">{rooms.length}</span>
              </div>
              {loading ? <div className="adm-loading"><span className="adm-spinner" /> Chargement…</div>
              : rooms.length === 0 ? <div className="adm-empty">Aucune salle</div>
              : rooms.map(room => (
                <div key={room.id} className="adm-room-item"
                  style={{ borderLeft: selectedRoom?.id===room.id ? "3px solid #0065b1" : "3px solid transparent", background: selectedRoom?.id===room.id ? "#e8f4ff" : "white" }}
                  onClick={() => setSelectedRoom(room)}>
                  <div style={{ fontWeight:600, fontSize:"0.85rem", color:"#1a1a2e" }}>{room.title}</div>
                  <div style={{ fontSize:"0.73rem", color:"#9ca3af", marginTop:2 }}>
                    {room.creator.name} · {room.enrollments} enrôlé{room.enrollments>1?"s":""}
                    {room.recordings>0?` · ${room.recordings} enreg.`:""}
                  </div>
                </div>
              ))}
            </div>
            <div className="adm-card adm-enroll-panel">
              {selectedRoom
                ? <EnrollPanel sessionId={selectedRoom.id} sessionTitle={selectedRoom.title} />
                : <div className="adm-empty" style={{ padding:48 }}>Sélectionnez une salle pour gérer ses enrôlements</div>
              }
            </div>
          </div>
        )}

        {/* UTILISATEURS — ADMIN seulement */}
        {tab === "users" && user.role === "ADMIN" && (
          <div className="adm-card">
            <div className="adm-card-header">
              <span className="adm-card-title">Utilisateurs</span>
              <span className="adm-count">{users.length}</span>
            </div>
            {loading ? <div className="adm-loading"><span className="adm-spinner" /> Chargement…</div> : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>Nom</th><th>Email</th><th>Rôle actuel</th><th>Salles</th><th>Inscrit le</th><th>Changer le rôle</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td className="adm-td-bold">{u.name}</td>
                        <td className="adm-td-muted">{u.email}</td>
                        <td><span className={`adm-badge adm-badge-${u.role.toLowerCase()}`}>{ROLE_LABELS[u.role]??u.role}</span></td>
                        <td className="adm-td-center">{u.sessionCount}</td>
                        <td className="adm-td-muted">{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                        <td>
                          <select className="adm-select" value={u.role} disabled={updatingRole===u.id} onChange={e => changeRole(u.id, e.target.value)}>
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
            )}
          </div>
        )}

        {/* ENREGISTREMENTS */}
        {tab === "recordings" && (
          <div className="adm-card">
            <div className="adm-card-header">
              <span className="adm-card-title">Enregistrements</span>
              <span className="adm-count">{recordings.length}</span>
            </div>
            {loading ? <div className="adm-loading"><span className="adm-spinner" /> Chargement…</div>
            : recordings.length === 0 ? <div className="adm-empty">Aucun enregistrement</div>
            : recordings.map(rec => (
              <div key={rec.id} className="adm-rec-item">
                <div className="adm-rec-row">
                  <svg className="adm-rec-icon" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
                  </svg>
                  <div className="adm-rec-info">
                    <span className="adm-rec-filename">{rec.filename}</span>
                    <div className="adm-rec-meta">
                      <span>🏠 {rec.session.title}</span>
                      <span>👤 {rec.session.creator.name}</span>
                      {rec.duration!=null && <span>⏱ {formatDur(rec.duration)}</span>}
                      {rec.size!=null && <span>💾 {formatSize(rec.size)}</span>}
                      <span>{new Date(rec.createdAt).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"})}</span>
                    </div>
                  </div>
                  <div className="adm-rec-actions">
                    <button className="adm-btn adm-btn-primary" onClick={() => setPlayingKey(playingKey===rec.s3Key?null:rec.s3Key)}>
                      {playingKey===rec.s3Key?"✖ Fermer":"▶ Voir"}
                    </button>
                    <a href={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}
                      className="adm-btn adm-btn-green" target="_blank" rel="noopener noreferrer">
                      ⬇ Télécharger
                    </a>
                    {user.role === "ADMIN" && (
                      <button className="adm-btn adm-btn-delete" disabled={deletingRec===rec.id}
                        onClick={() => deleteRecording(rec.id, rec.filename)}>
                        {deletingRec===rec.id?"…":"🗑 Supprimer"}
                      </button>
                    )}
                  </div>
                </div>
                {playingKey===rec.s3Key && (
                  <div className="adm-rec-player">
                    <video controls autoPlay src={`/api/download-recording?key=${encodeURIComponent(rec.s3Key)}`}>
                      Votre navigateur ne supporte pas la lecture vidéo.
                    </video>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="adm-footer">
        <p>Ministère de l&apos;Enseignement Supérieur, de la Recherche et de l&apos;Innovation</p>
        <p className="adm-footer-strong">Université Numérique Cheikh Hamidou Kane (UN-CHK)</p>
        <p className="adm-footer-copy">© DITSI – UN-CHK – 2026 – Tous droits réservés</p>
      </footer>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        .adm-root{min-height:100vh;display:flex;flex-direction:column;background:#f8fafd;font-family:'Google Sans','Segoe UI',system-ui,sans-serif;color:#1a1a2e;}
        .adm-header{display:flex;align-items:center;justify-content:space-between;padding:0 32px;height:64px;background:#fff;border-bottom:1px solid #e2e8f0;}
        .adm-logo-link{display:flex;align-items:center;}
        .adm-header-right{display:flex;align-items:center;gap:12px;}
        .adm-username{font-size:0.88rem;color:#374151;font-weight:500;}
        .adm-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 16px;border-radius:8px;font-size:0.83rem;font-weight:600;font-family:inherit;cursor:pointer;text-decoration:none;border:none;white-space:nowrap;transition:filter .15s;}
        .adm-btn-outline:hover:not(:disabled){background:#e8f4ff;} .adm-btn-danger:hover:not(:disabled){background:#fff0f0;} .adm-btn-primary:hover:not(:disabled){background:#004d8c;} .adm-btn-green:hover:not(:disabled){background:#e6f7eb;} .adm-btn-delete:hover:not(:disabled){background:#fff0f0;}
        .adm-btn:disabled{opacity:.45;cursor:not-allowed;}
        .adm-btn-outline{background:#fff;border:1.5px solid #0065b1;color:#0065b1;}
        .adm-btn-danger{background:#fff;border:1.5px solid #e53e3e;color:#e53e3e;}
        .adm-btn-primary{background:#0065b1;color:#fff;}
        .adm-btn-green{background:#fff;border:1.5px solid #2fb344;color:#2fb344;}
        .adm-btn-delete{background:#fff;border:1.5px solid #e53e3e;color:#e53e3e;}
        .adm-page-title{padding:28px 32px 0;}
        .adm-page-title h1{font-size:1.6rem;font-weight:700;}
        .adm-page-title p{font-size:0.88rem;color:#6b7280;margin-top:4px;}
        .adm-tabs-wrap{padding:20px 32px 0;}
        .adm-tabs{display:flex;border-bottom:2px solid #e2e8f0;}
        .adm-tab{padding:10px 24px;background:none;border:none;font-family:inherit;font-size:0.88rem;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s;}
        .adm-tab:hover{color:#0065b1;}
        .adm-tab.active{color:#0065b1;border-bottom-color:#0065b1;font-weight:700;}
        .adm-main{flex:1;max-width:1140px;width:100%;margin:0 auto;padding:24px 32px 40px;}
        .adm-card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;}
        .adm-card-header{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #f0f7ff;}
        .adm-card-title{font-size:0.95rem;font-weight:700;}
        .adm-count{background:#e8f4ff;color:#0065b1;font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:10px;}
        .adm-loading{display:flex;align-items:center;gap:10px;padding:40px 24px;color:#9ca3af;}
        .adm-spinner{width:16px;height:16px;border:2px solid #e2e8f0;border-top-color:#0065b1;border-radius:50%;animation:adm-spin .7s linear infinite;display:inline-block;}
        @keyframes adm-spin{to{transform:rotate(360deg)}}
        .adm-empty{padding:40px;text-align:center;color:#9ca3af;font-size:0.9rem;}
        .adm-rooms-layout{display:flex;gap:16px;align-items:flex-start;}
        .adm-rooms-list{width:300px;flex-shrink:0;}
        .adm-enroll-panel{flex:1;min-width:0;}
        .adm-room-item{padding:12px 18px;cursor:pointer;border-bottom:1px solid #f0f7ff;transition:background .12s;}
        .adm-room-item:last-child{border-bottom:none;}
        .adm-room-item:hover{background:#f8fbff;}
        .adm-table-wrap{overflow-x:auto;}
        .adm-table{width:100%;border-collapse:collapse;}
        .adm-table th{padding:10px 20px;background:#f8fbff;font-size:0.75rem;font-weight:600;color:#6b7280;text-align:left;border-bottom:1px solid #e8f4ff;white-space:nowrap;}
        .adm-table td{padding:13px 20px;font-size:0.85rem;border-bottom:1px solid #f0f7ff;vertical-align:middle;}
        .adm-table tr:last-child td{border-bottom:none;}
        .adm-table tr:hover td{background:#f8fbff;}
        .adm-td-bold{font-weight:600;}
        .adm-td-muted{color:#6b7280;font-size:0.82rem;}
        .adm-td-center{text-align:center;color:#6b7280;}
        .adm-badge{padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;}
        .adm-badge-admin{background:#fee2e2;color:#b91c1c;}
        .adm-badge-moderator{background:#dbeafe;color:#1e40af;}
        .adm-badge-viewer{background:#f3f4f6;color:#374151;}
        .adm-select{padding:5px 10px;border:1.5px solid #e2e8f0;border-radius:7px;font-size:0.82rem;color:#1a1a2e;font-family:inherit;cursor:pointer;background:#fff;}
        .adm-select:focus{border-color:#0065b1;outline:none;}
        .adm-select:disabled{opacity:.5;cursor:not-allowed;}
        .adm-rec-item{border-bottom:1px solid #f0f7ff;}
        .adm-rec-item:last-child{border-bottom:none;}
        .adm-rec-row{display:flex;align-items:center;gap:14px;padding:14px 20px;}
        .adm-rec-icon{width:28px;height:28px;color:#0065b1;flex-shrink:0;}
        .adm-rec-info{flex:1;min-width:0;}
        .adm-rec-filename{font-size:0.88rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;}
        .adm-rec-meta{display:flex;gap:14px;margin-top:4px;flex-wrap:wrap;}
        .adm-rec-meta span{font-size:0.75rem;color:#9ca3af;}
        .adm-rec-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
        .adm-rec-player{padding:0 20px 16px;}
        .adm-rec-player video{width:100%;max-height:420px;border-radius:8px;background:#000;display:block;}
        .adm-footer{background:#fff;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;display:flex;flex-direction:column;gap:3px;margin-top:auto;}
        .adm-footer p{font-size:0.78rem;color:#6b7280;}
        .adm-footer-strong{font-size:0.88rem;font-weight:700;color:#0065b1!important;}
        .adm-footer-copy{font-size:0.72rem;color:#9ca3af!important;}
        @media(max-width:900px){.adm-rooms-layout{flex-direction:column;}.adm-rooms-list{width:100%;}.adm-header,.adm-page-title,.adm-tabs-wrap,.adm-main{padding-left:16px;padding-right:16px;}}
      `}</style>
    </div>
  )
}
