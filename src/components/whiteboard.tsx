"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRoomContext, useLocalParticipant } from "@livekit/components-react"

const WB_TOPIC = "wb"
const MIN_DISTANCE = 0.003

type WBEvent = {
  v: 1
  type: "draw" | "clear" | "text"
  tool?: "pen" | "eraser"
  color?: string
  size?: number
  x0?: number; y0?: number; x1?: number; y1?: number
  text?: string; fontSize?: number; tx?: number; ty?: number
}

type WBInit = { v: 1; type: "init"; events: WBEvent[] }
type WBMsg = WBEvent | WBInit

const COLORS = ["#1a1a2e","#0065b1","#e53e3e","#2fb344","#d97706","#a855f7","#ffffff"]
const SIZES  = [2, 5, 10, 20]

function replayEvent(ctx: CanvasRenderingContext2D, ev: WBEvent) {
  if (ev.type === "clear") {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    return
  }
  if (ev.type === "text" && ev.text && ev.tx !== undefined && ev.ty !== undefined) {
    ctx.save()
    ctx.font = `${ev.fontSize ?? 20}px 'Google Sans',sans-serif`
    ctx.fillStyle = ev.color ?? "#1a1a2e"
    ctx.fillText(ev.text, ev.tx * ctx.canvas.width, ev.ty * ctx.canvas.height)
    ctx.restore()
    return
  }
  if (ev.type === "draw" && ev.x0 !== undefined) {
    ctx.save()
    if (ev.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out"
      ctx.strokeStyle = "rgba(0,0,0,1)"
    } else {
      ctx.globalCompositeOperation = "source-over"
      ctx.strokeStyle = ev.color ?? "#1a1a2e"
    }
    ctx.lineWidth = ev.size ?? 3
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(ev.x0 * ctx.canvas.width, ev.y0! * ctx.canvas.height)
    ctx.lineTo(ev.x1! * ctx.canvas.width, ev.y1! * ctx.canvas.height)
    ctx.stroke()
    ctx.restore()
  }
}

export default function Whiteboard({
  readOnly = false,
}: {
  readOnly?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDrawing = useRef(false)
  const hasMoved = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const eventStore = useRef<WBEvent[]>([])
  const batchRef = useRef<WBEvent[]>([])
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasReceivedInit = useRef(false)

  const [tool, setTool]   = useState<"pen"|"eraser">("pen")
  const [color, setColor] = useState("#1a1a2e")
  const [size, setSize]   = useState(3)
  const [textMode, setTextMode] = useState(false)
  const [textPos, setTextPos]   = useState<{x:number;y:number}|null>(null)
  const [textVal, setTextVal]   = useState("")
  const textInputRef = useRef<HTMLInputElement>(null)

  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()

  // Resize canvas to container
  useEffect(() => {
    const resize = () => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return
      const { width, height } = container.getBoundingClientRect()
      const w = Math.round(width)
      const h = Math.round(height)
      if (canvas.width === w && canvas.height === h) return
      const tmp = document.createElement("canvas")
      tmp.width = canvas.width; tmp.height = canvas.height
      tmp.getContext("2d")!.drawImage(canvas, 0, 0)
      canvas.width = w
      canvas.height = h
      canvas.getContext("2d")!.drawImage(tmp, 0, 0, w, h)
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Envoyer l'historique complet avec topic
  const sendInit = useCallback(() => {
    if (readOnly) return
    if (eventStore.current.length === 0) return
    const init: WBInit = { v: 1, type: "init", events: eventStore.current }
    localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(init)),
      { reliable: true, topic: WB_TOPIC }
    )
  }, [readOnly, localParticipant])

  // Demander le snapshot (côté spectateur/egress)
  const requestInit = useCallback(() => {
    try {
      localParticipant.publishData(
        new TextEncoder().encode("__wb_request_init__"),
        { reliable: true, topic: WB_TOPIC }
      )
    } catch {}
  }, [localParticipant])

  // Côté spectateur : demander le snapshot au montage si pas encore reçu
  useEffect(() => {
    if (!readOnly) return
    // Demander le snapshot à 1s, 3s et 6s (au cas où l'hôte n'a pas encore répondu)
    const t1 = setTimeout(() => { if (!hasReceivedInit.current) requestInit() }, 1000)
    const t2 = setTimeout(() => { if (!hasReceivedInit.current) requestInit() }, 3000)
    const t3 = setTimeout(() => { if (!hasReceivedInit.current) requestInit() }, 6000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [readOnly, requestInit])

  // Recevoir données LiveKit — filtré par topic "wb" + ignorer self
  useEffect(() => {
    const handleData = (payload: Uint8Array, participant: any, _kind: any, topic?: string) => {
      if (topic !== WB_TOPIC && topic !== undefined) return
      if (participant?.identity === localParticipant.identity) return

      try {
        const raw = new TextDecoder().decode(payload)

        if (raw === "__wb_request_init__") {
          // Quelqu'un demande le snapshot — l'envoyer avec un petit délai
          setTimeout(() => sendInit(), 200)
          return
        }

        const msg: WBMsg = JSON.parse(raw)
        if (!msg || msg.v !== 1) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")!

        if (msg.type === "init") {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          eventStore.current = [...msg.events]
          for (const ev of msg.events) replayEvent(ctx, ev)
          hasReceivedInit.current = true
          return
        }

        if (msg.type === "clear") {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          eventStore.current = []
          return
        }

        replayEvent(ctx, msg as WBEvent)
        eventStore.current.push(msg as WBEvent)
      } catch {}
    }

    // Quand un nouveau participant rejoint — envoyer le snapshot après un délai
    const handleParticipantConnected = () => {
      setTimeout(() => sendInit(), 500)
    }

    room.on("dataReceived", handleData)
    room.on("participantConnected", handleParticipantConnected)
    return () => {
      room.off("dataReceived", handleData)
      room.off("participantConnected", handleParticipantConnected)
    }
  }, [room, readOnly, localParticipant, sendInit])

  // Broadcast avec batch + topic
  const broadcast = useCallback((ev: WBEvent) => {
    eventStore.current.push(ev)
    batchRef.current.push(ev)
    if (!batchTimer.current) {
      batchTimer.current = setTimeout(() => {
        const batch = batchRef.current
        batchRef.current = []
        batchTimer.current = null
        for (const e of batch) {
          localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify(e)),
            { reliable: true, topic: WB_TOPIC }
          )
        }
      }, 16)
    }
  }, [localParticipant])

  // getPos corrigé avec rect.width/rect.height
  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top)  / rect.height,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return
    if (textMode) {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      setTextPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      setTextVal("")
      setTimeout(() => textInputRef.current?.focus(), 30)
      return
    }
    isDrawing.current = true
    hasMoved.current = false
    const pos = getPos(e)
    lastPos.current = pos
    startPos.current = pos
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || readOnly || textMode) return
    const pos = getPos(e)

    if (!hasMoved.current) {
      const dx = pos.x - startPos.current.x
      const dy = pos.y - startPos.current.y
      if (Math.sqrt(dx * dx + dy * dy) < MIN_DISTANCE) return
      hasMoved.current = true
    }

    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    const ev: WBEvent = {
      v: 1, type: "draw", tool, color, size,
      x0: lastPos.current.x, y0: lastPos.current.y,
      x1: pos.x, y1: pos.y,
    }
    replayEvent(ctx, ev)
    broadcast(ev)
    lastPos.current = pos
  }

  const onPointerUp = () => {
    isDrawing.current = false
    hasMoved.current = false
  }

  const confirmText = () => {
    if (!textVal.trim() || !textPos) { setTextPos(null); return }
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const fontSize = size * 6 + 10
    const ev: WBEvent = {
      v: 1, type: "text", color, fontSize, text: textVal,
      tx: textPos.x / rect.width,
      ty: textPos.y / rect.height,
    }
    const ctx = canvas.getContext("2d")!
    replayEvent(ctx, ev)
    broadcast(ev)
    setTextPos(null); setTextVal("")
  }

  const clearAll = () => {
    const canvas = canvasRef.current!
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    eventStore.current = []
    localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ v: 1, type: "clear" })),
      { reliable: true, topic: WB_TOPIC }
    )
  }

  const toolbarH = readOnly ? 0 : 56

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "white" }}>

      {!readOnly && (
        <div style={{ height: toolbarH, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "#f8fafd", borderBottom: "1px solid #e2e8f0", flexShrink: 0, flexWrap: "wrap" }}>
          {([
            { id: "pen"    as const, label: "✏️", title: "Crayon" },
            { id: "text"   as const, label: "T",  title: "Texte" },
            { id: "eraser" as const, label: "⌫",  title: "Gomme" },
          ]).map(t => (
            <button key={t.id}
              title={t.title}
              onClick={() => { if (t.id === "text") setTextMode(!textMode); else { setTool(t.id); setTextMode(false) } }}
              style={{ width: 36, height: 36, borderRadius: 8, border: `2px solid ${(t.id === "text" ? textMode : tool === t.id && !textMode) ? "#0065b1" : "#e2e8f0"}`, background: (t.id === "text" ? textMode : tool === t.id && !textMode) ? "#e8f4ff" : "white", cursor: "pointer", fontSize: t.id === "text" ? 15 : 17, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
              {t.label}
            </button>
          ))}

          <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />

          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool("pen"); setTextMode(false) }}
              style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: color === c && tool !== "eraser" && !textMode ? "3px solid #0065b1" : "2px solid #d1d5db", cursor: "pointer", flexShrink: 0 }} />
          ))}

          <div style={{ width: 1, height: 32, background: "#e2e8f0" }} />

          {SIZES.map(s => (
            <button key={s} onClick={() => setSize(s)}
              style={{ width: 32, height: 32, borderRadius: 8, border: `2px solid ${size === s ? "#0065b1" : "#e2e8f0"}`, background: size === s ? "#e8f4ff" : "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: Math.max(3, s * 1.4), height: Math.max(3, s * 1.4), borderRadius: "50%", background: "#374151" }} />
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <button onClick={clearAll}
            style={{ padding: "6px 14px", background: "white", color: "#e53e3e", border: "1px solid #e53e3e", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            🗑 Effacer
          </button>
        </div>
      )}

      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", cursor: readOnly ? "default" : textMode ? "text" : tool === "eraser" ? "cell" : "crosshair", touchAction: "none", background: "white" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />

        {textPos && (
          <input
            ref={textInputRef}
            value={textVal}
            onChange={e => setTextVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirmText(); if (e.key === "Escape") setTextPos(null) }}
            onBlur={confirmText}
            style={{ position: "absolute", left: textPos.x, top: textPos.y - 20, background: "transparent", border: "none", borderBottom: `2px solid ${color}`, outline: "none", fontSize: size * 6 + 10, color, fontFamily: "'Google Sans',sans-serif", minWidth: 120, zIndex: 10 }}
            placeholder="Texte…"
          />
        )}

        {readOnly && (
          <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,.6)", color: "white", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5, pointerEvents: "none" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Lecture seule
          </div>
        )}
      </div>
    </div>
  )
}
