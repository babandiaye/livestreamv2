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

    // Egress terminé avec succès
    if (event.event === "egress_ended" && event.egressInfo) {
      const egress = event.egressInfo
      const roomName = egress.roomName

      console.log("[webhook] egress_ended:", {
        egressId: egress.egressId,
        roomName,
        status: egress.status,
      })

      // Récupérer les infos du fichier S3
      const fileResults = egress.fileResults
      if (fileResults && fileResults.length > 0) {
        const file = fileResults[0]
        const s3Key = file.filename ?? ""
        const filename = s3Key.split("/").pop() ?? s3Key
        const size = file.size ? BigInt(file.size.toString()) : null
        const duration = file.duration
          ? Math.round(Number(file.duration) / 1_000_000_000)
          : null

        //console.log("[webhook] file:", { s3Key, filename, size, duration })
        console.log("[webhook] file raw:", JSON.stringify(file))
        // Trouver la session en base
        const dbSession = await prisma.session.findUnique({
          where: { roomName },
        })

        if (dbSession) {
          // Vérifier si l'enregistrement existe déjà
          const existing = await prisma.recording.findFirst({
            where: { egressId: egress.egressId },
          })

          if (!existing) {
            await prisma.recording.create({
              data: {
                sessionId: dbSession.id,
                s3Key,
                s3Bucket: process.env.S3_BUCKET ?? "preprod-webinairerecordings",
                filename,
                size,
                duration,
                egressId: egress.egressId,
              },
            })
            console.log("[webhook] Recording saved to DB:", filename)
          }

          // Mettre à jour le status session
          await prisma.session.update({
            where: { id: dbSession.id },
            data: { status: "ENDED", endedAt: new Date() },
          })
        } else {
          console.warn("[webhook] Session not found for roomName:", roomName)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[webhook] error:", err)
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 })
  }
}
