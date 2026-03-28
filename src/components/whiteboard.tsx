"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRoomContext, useLocalParticipant } from "@livekit/components-react"

const WB_TOPIC = "whiteboard-v2"

export default function Whiteboard({ readOnly = false }: { readOnly?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const isSyncing = useRef(false)
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()

  // Recevoir depuis les autres participants LiveKit
  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload))
        if (msg.topic !== WB_TOPIC) return
        isSyncing.current = true
        iframeRef.current?.contentWindow?.postMessage(
          msg.clear ? { type: "wb-clear" } : { type: "wb-update", elements: msg.elements },
          "*"
        )
        setTimeout(() => { isSyncing.current = false }, 200)
      } catch {}
    }
    room.on("dataReceived", handleData)
    return () => { room.off("dataReceived", handleData) }
  }, [room])

  // Recevoir depuis l'iframe Excalidraw
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (readOnly) return
      if (e.data.type === "wb-change" && !isSyncing.current) {
        if (throttleRef.current) clearTimeout(throttleRef.current)
        throttleRef.current = setTimeout(() => {
          localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({
              topic: WB_TOPIC,
              elements: e.data.elements
            })),
            { reliable: true }
          )
        }, 120)
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [readOnly, localParticipant])

  const src = readOnly
    ? "/whiteboard.html?readonly=true"
    : "/whiteboard.html"

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 9999, background: "white" }}>
      <iframe
        ref={iframeRef}
        src={src}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        allow="clipboard-read; clipboard-write"
      />
      {readOnly && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 99999, background: "rgba(0,0,0,.7)", color: "white", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5, pointerEvents: "none" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Lecture seule
        </div>
      )}
    </div>
  )
}
