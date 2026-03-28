"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRoomContext, useLocalParticipant } from "@livekit/components-react"

const WB_TOPIC = "whiteboard"
const CURSOR_TOPIC = "wb-cursor"

type ExcalidrawElement = Record<string, unknown>
type CursorData = { identity: string; x: number; y: number; color: string }

const COLORS = ["#0065b1","#e53e3e","#2fb344","#d97706","#a855f7","#ec4899","#0891b2"]

function colorForIdentity(identity: string) {
  let hash = 0
  for (let i = 0; i < identity.length; i++) hash = identity.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return size
}

export default function Whiteboard({ readOnly = false }: { readOnly?: boolean }) {
  const [ExcalidrawComp, setExcalidrawComp] = useState<any>(null)
  const [initialElements, setInitialElements] = useState<ExcalidrawElement[]>([])
  const [cursors, setCursors] = useState<Record<string, CursorData>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const excalidrawRef = useRef<any>(null)
  const isSyncing = useRef(false)
  const broadcastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
  const { width, height } = useContainerSize(containerRef)

  // Charger Excalidraw dynamiquement
  useEffect(() => {
    import("@excalidraw/excalidraw").then(mod => {
      setExcalidrawComp(() => mod.Excalidraw)
    })
  }, [])

  // Recevoir les données des autres participants
  useEffect(() => {
    const handleData = (payload: Uint8Array, participant: any) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload))

        if (msg.topic === WB_TOPIC && msg.elements && excalidrawRef.current) {
          isSyncing.current = true
          // Mettre à jour via l'API Excalidraw (pas via props)
          excalidrawRef.current.updateScene({ elements: msg.elements })
          setTimeout(() => { isSyncing.current = false }, 150)
        }

        if (msg.topic === CURSOR_TOPIC && participant) {
          const identity = participant.identity
          setCursors(prev => ({
            ...prev,
            [identity]: { identity, x: msg.x, y: msg.y, color: colorForIdentity(identity) }
          }))
          setTimeout(() => {
            setCursors(prev => { const n = { ...prev }; delete n[identity]; return n })
          }, 3000)
        }
      } catch {}
    }
    room.on("dataReceived", handleData)
    return () => { room.off("dataReceived", handleData) }
  }, [room])

  // Broadcast avec throttle 200ms
  const broadcastElements = useCallback((els: ExcalidrawElement[]) => {
    if (broadcastTimeout.current) clearTimeout(broadcastTimeout.current)
    broadcastTimeout.current = setTimeout(() => {
      localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ topic: WB_TOPIC, elements: els })),
        { reliable: true }
      )
    }, 200)
  }, [localParticipant])

  const broadcastCursor = useCallback((x: number, y: number) => {
    localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ topic: CURSOR_TOPIC, x, y })),
      { reliable: false }
    )
  }, [localParticipant])

  // onChange — sans elements contrôlé
  const handleChange = useCallback((els: readonly ExcalidrawElement[]) => {
    if (isSyncing.current || readOnly) return
    broadcastElements(els as ExcalidrawElement[])
  }, [broadcastElements, readOnly])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (readOnly) return
    const rect = e.currentTarget.getBoundingClientRect()
    broadcastCursor(e.clientX - rect.left, e.clientY - rect.top)
  }, [readOnly, broadcastCursor])

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      style={{ position: "absolute", inset: 0, background: "#f8f9fa" }}
    >
      {ExcalidrawComp && width > 0 && height > 0 ? (
        <div style={{ width, height }}>
          <ExcalidrawComp
            ref={excalidrawRef}
            initialData={{
              elements: initialElements,
              appState: { viewBackgroundColor: "#f8f9fa" }
            }}
            onChange={handleChange}
            viewModeEnabled={readOnly}
            zenModeEnabled={false}
            gridModeEnabled={true}
            theme="light"
            langCode="fr-FR"
            UIOptions={{
              canvasActions: {
                export: false,
                loadScene: false,
                saveToActiveFile: false,
                saveAsImage: !readOnly,
              },
            }}
          />
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14, gap: 8 }}>
          <div style={{ width: 16, height: 16, border: "2px solid #e2e8f0", borderTopColor: "#0065b1", borderRadius: "50%", animation: "wb-spin .7s linear infinite", display: "inline-block" }} />
          Chargement du tableau blanc…
          <style>{`@keyframes wb-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Curseurs des autres participants */}
      {Object.values(cursors).map(cursor => (
        <div key={cursor.identity} style={{ position: "absolute", left: cursor.x, top: cursor.y, pointerEvents: "none", zIndex: 100 }}>
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M5 3l14 9-7 1-4 7z" fill={cursor.color} stroke="white" strokeWidth="1"/>
          </svg>
          <div style={{ background: cursor.color, color: "white", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 10, marginLeft: 14, marginTop: -4, whiteSpace: "nowrap" }}>
            {cursor.identity}
          </div>
        </div>
      ))}

      {readOnly && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 9999, background: "rgba(0,0,0,.6)", color: "white", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5, pointerEvents: "none" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Lecture seule
        </div>
      )}
    </div>
  )
}
