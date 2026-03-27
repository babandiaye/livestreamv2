import { WebhookReceiver } from "livekit-server-sdk"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
export const dynamic = "force-dynamic"

const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const authHeader = req.headers.get("Authorization") ?? ""
    const event = await receiver.receive(body, authHeader)
    console.log("[webhook] event:", event.event)

    // ── Room terminée ──
    if (event.event === "room_finished" && event.room) {
      const roomName = event.room.name
      await prisma.session.updateMany({
        where: { roomName, status: "LIVE" },
        data: { status: "ENDED", endedAt: new Date() },
      })
      console.log("[webhook] Session ENDED:", roomName)
    }

    // ── Egress démarré → Recording PROCESSING ──
    if (event.event === "egress_started" && event.egressInfo) {
      const egress = event.egressInfo
      const roomName = egress.roomName
      console.log("[webhook] egress_started:", egress.egressId, roomName)

      const dbSession = await prisma.session.findUnique({ where: { roomName } })
      if (dbSession) {
        const existing = await prisma.recording.findFirst({
          where: { egressId: egress.egressId },
        })
        if (!existing) {
          await prisma.recording.create({
            data: {
              sessionId: dbSession.id,
              s3Key: "",
              s3Bucket: process.env.S3_BUCKET ?? "preprod-webinairerecordings",
              filename: `Enregistrement en cours…`,
              egressId: egress.egressId,
              status: "PROCESSING",
              startedAt: new Date(),
            },
          })
          console.log("[webhook] Recording PROCESSING créé:", egress.egressId)
        }
      }
    }

    // ── Egress terminé avec succès → Recording READY ──
    if (event.event === "egress_ended" && event.egressInfo) {
      const egress = event.egressInfo
      const roomName = egress.roomName
      console.log("[webhook] egress_ended:", egress.egressId, "status:", egress.status)

      const fileResults = egress.fileResults
      if (fileResults && fileResults.length > 0) {
        const file = fileResults[0]
        const s3Key = file.filename ?? ""
        const filename = s3Key.split("/").pop() ?? s3Key
        const size = file.size ? BigInt(file.size.toString()) : null
        const duration = file.duration
          ? Math.round(Number(file.duration) / 1_000_000_000)
          : null

        // Chercher le recording PROCESSING existant
        const existing = await prisma.recording.findFirst({
          where: { egressId: egress.egressId },
        })

        if (existing) {
          // Mettre à jour PROCESSING → READY
          await prisma.recording.update({
            where: { id: existing.id },
            data: { s3Key, filename, size, duration, status: "READY" },
          })
          console.log("[webhook] Recording READY:", filename)
        } else {
          // Fallback — créer directement READY si egress_started manqué
          const dbSession = await prisma.session.findUnique({ where: { roomName } })
          if (dbSession) {
            await prisma.recording.create({
              data: {
                sessionId: dbSession.id,
                s3Key,
                s3Bucket: process.env.S3_BUCKET ?? "preprod-webinairerecordings",
                filename,
                size,
                duration,
                egressId: egress.egressId,
                status: "READY",
              },
            })
            console.log("[webhook] Recording READY (fallback):", filename)
          }
        }
      } else {
        // Pas de fichier → FAILED
        const existing = await prisma.recording.findFirst({
          where: { egressId: egress.egressId },
        })
        if (existing) {
          await prisma.recording.update({
            where: { id: existing.id },
            data: { status: "FAILED" },
          })
          console.log("[webhook] Recording FAILED:", egress.egressId)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[webhook] error:", err)
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 })
  }
}
