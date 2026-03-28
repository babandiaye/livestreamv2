"use client"

import { useSearchParams } from "next/navigation"
import {
  LiveKitRoom, useTracks, useParticipants,
  VideoTrack, AudioTrack, useChat, useRoomContext,
} from "@livekit/components-react"
import { Track } from "livekit-client"
import { useEffect, useRef, useState } from "react"

const WB_TOPIC = "whiteboard"
type DrawEvent = { type: "draw"|"clear"|"text"; tool?: string; color?: string; size?: number; x0?: number; y0?: number; x1?: number; y1?: number; text?: string; fontSize?: number; tx?: number; ty?: number }

export default function EgressLayoutClient() {
  const params = useSearchParams()
  const roomName = params.get("roomName") ?? ""
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!roomName) return
    fetch(`/api/egress-token?roomName=${encodeURIComponent(roomName)}`)
      .then(r => r.json())
      .then(d => setToken(d.token))
      .catch(console.error)
  }, [roomName])

  if (!roomName || !token) {
    return <div style={{ background: "#0d1117", height: "100vh", width: "100vw" }} />
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
      connect={true}
      style={{ height: "100vh", width: "100vw", background: "#0d1117" }}
    >
      <EgressRoom />
    </LiveKitRoom>
  )
}

function EgressRoom() {
  const tracks = useTracks([
    Track.Source.Camera,
    Track.Source.ScreenShare,
    Track.Source.Microphone,
  ])
  const participants = useParticipants()
  const { chatMessages } = useChat()
  const chatRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const room = useRoomContext()

  // Écouter les events tableau blanc
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const ev: DrawEvent = JSON.parse(new TextDecoder().decode(payload))
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        if (ev.type === "clear") { ctx.clearRect(0, 0, canvas.width, canvas.height); setShowWhiteboard(false); return }
        setShowWhiteboard(true)
        if (ev.type === "text" && ev.text && ev.tx !== undefined) {
          ctx.font = `${ev.fontSize ?? 20}px sans-serif`
          ctx.fillStyle = ev.color ?? "#000"
          ctx.fillText(ev.text, ev.tx * canvas.width, ev.ty! * canvas.height)
          return
        }
        if (ev.type === "draw" && ev.x0 !== undefined) {
          ctx.strokeStyle = ev.tool === "eraser" ? "#ffffff" : (ev.color ?? "#000")
          ctx.lineWidth = ev.size ?? 3
          ctx.lineCap = "round"
          ctx.lineJoin = "round"
          ctx.beginPath()
          ctx.moveTo(ev.x0 * canvas.width, ev.y0! * canvas.height)
          ctx.lineTo(ev.x1! * canvas.width, ev.y1! * canvas.height)
          ctx.stroke()
        }
      } catch {}
    }
    room.on("dataReceived", handleData)
    return () => { room.off("dataReceived", handleData) }
  }, [room])

  const screenTrack = tracks.find(t => t.source === Track.Source.ScreenShare)
  const camTracks = tracks.filter(t => t.source === Track.Source.Camera)
  const audioTracks = tracks.filter(t => t.source === Track.Source.Microphone)
  const mainCamTrack = camTracks[0]

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [chatMessages])

  const visibleMessages = chatMessages.filter(
    m => m.message && !m.message.startsWith("__emoji__")
  )

  return (
    <div style={{
      display: "flex",
      width: "100vw",
      height: "100vh",
      background: "#0d1117",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* ── Zone principale ── */}
      <div style={{ flex: 1, position: "relative", background: "#070d14" }}>

        {/* Contenu principal — partage écran ou cam */}
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {screenTrack ? (
            <VideoTrack trackRef={screenTrack}
              style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : mainCamTrack ? (
            <VideoTrack trackRef={mainCamTrack}
              style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 16, color: "#475569"
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "#0065b1",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem", fontWeight: 700, color: "white"
              }}>
                {participants[0]?.identity?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <span style={{ fontSize: "1rem", color: "#64748b" }}>
                {participants[0]?.identity ?? "En attente…"}
              </span>
            </div>
          )}
        </div>

        {/* PiP cam animateur — bas droite quand partage écran actif */}
        {screenTrack && mainCamTrack && (
          <div style={{
            position: "absolute", bottom: 20, right: 20,
            width: 240, height: 150,
            borderRadius: 10, overflow: "hidden",
            border: "2px solid #0065b1",
            boxShadow: "0 4px 20px rgba(0,0,0,.6)",
            background: "#1e2d3d",
            zIndex: 10,
          }}>
            <VideoTrack trackRef={mainCamTrack}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{
              position: "absolute", bottom: 4, left: 8,
              fontSize: "0.7rem", color: "white",
              background: "rgba(0,0,0,.6)", padding: "2px 6px", borderRadius: 3
            }}>
              {mainCamTrack.participant.identity}
            </div>
          </div>
        )}

        {/* Strip participants sur scène (sans partage écran) */}
        {!screenTrack && camTracks.length > 1 && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            display: "flex", gap: 8, padding: 8,
            background: "rgba(13,17,23,.85)",
          }}>
            {camTracks.slice(1).map(t => (
              <div key={t.participant.identity} style={{
                width: 140, height: 90, borderRadius: 7, overflow: "hidden",
                border: "1px solid #2d3f52", flexShrink: 0, position: "relative",
              }}>
                <VideoTrack trackRef={t}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{
                  position: "absolute", bottom: 3, left: 5,
                  fontSize: "0.65rem", color: "white",
                  background: "rgba(0,0,0,.6)", padding: "1px 5px", borderRadius: 3
                }}>
                  {t.participant.identity}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Badge EN DIRECT */}
        <div style={{
          position: "absolute", top: 16, left: 16,
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(239,68,68,.15)",
          border: "1px solid rgba(239,68,68,.4)",
          borderRadius: 20, padding: "4px 12px",
          fontSize: "0.72rem", fontWeight: 700, color: "#ef4444",
          letterSpacing: "0.05em",
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#ef4444", display: "inline-block",
            animation: "pulse 1.2s ease-in-out infinite",
          }} />
          EN DIRECT
        </div>

        {/* Logo UN-CHK */}
        <div style={{
          position: "absolute", top: 16, right: 16,
          opacity: 0.7,
        }}>
          <img src="/logo-unchk.png" alt="UN-CHK"
            style={{ height: "28px", objectFit: "contain" }} />
        </div>
      </div>

      {/* ── Panneau Chat ── */}
      <div style={{
        width: 300, flexShrink: 0,
        background: "#111827",
        borderLeft: "1px solid #1e2d3d",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header chat */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid #1e2d3d",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: "0.85rem", fontWeight: 700, color: "#e2e8f0",
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat en direct
          <span style={{
            marginLeft: "auto", background: "#1e2d3d",
            color: "#94a3b8", fontSize: "0.7rem", fontWeight: 600,
            padding: "2px 7px", borderRadius: 10,
          }}>
            {participants.length} en ligne
          </span>
        </div>

        {/* Messages */}
        <div ref={chatRef} style={{
          flex: 1, overflowY: "auto", padding: "12px 14px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {visibleMessages.length === 0 ? (
            <div style={{
              textAlign: "center", color: "#475569",
              fontSize: "0.8rem", marginTop: 20
            }}>
              Aucun message pour l&apos;instant
            </div>
          ) : visibleMessages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#0065b1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", fontWeight: 700, color: "white", flexShrink: 0,
                }}>
                  {msg.from?.identity?.charAt(0)?.toUpperCase() ?? "?"}
                </div>
                <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#60a5fa" }}>
                  {msg.from?.identity ?? "Anonyme"}
                </span>
                <span style={{ fontSize: "0.65rem", color: "#475569", marginLeft: "auto" }}>
                  {new Date(msg.timestamp).toLocaleTimeString("fr-FR", {
                    hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
              <div style={{
                background: "#1e2d3d", borderRadius: "0 8px 8px 8px",
                padding: "6px 10px", fontSize: "0.8rem", color: "#e2e8f0",
                lineHeight: 1.4, wordBreak: "break-word",
              }}>
                {msg.message}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audio tracks */}
      {audioTracks.map(t => (
        <AudioTrack key={t.participant.identity} trackRef={t} />
      ))}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #2d3f52; border-radius: 2px; }
      `}</style>
    </div>
  )
}
