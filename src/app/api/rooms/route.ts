import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { keycloakId: session.user.id },
      include: {
        sessions: {
          orderBy: { createdAt: "desc" },
          include: {
            recordings: {
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                filename: true,
                s3Key: true,
                s3Bucket: true,
                duration: true,
                egressId: true,
                publishable: true,
                createdAt: true,
                size: false,
              },
            },
          },
        },
      },
    })

    // Sérialiser proprement (éviter BigInt)
    const rooms = (user?.sessions ?? []).map(s => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      startedAt: s.startedAt?.toISOString() ?? null,
      endedAt: s.endedAt?.toISOString() ?? null,
      recordings: s.recordings.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    }))

    return NextResponse.json({ rooms })
  } catch (err) {
    console.error("[api/rooms] error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const { title, description, chatEnabled, participationEnabled } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: "Titre requis" }, { status: 400 })

    const user = await prisma.user.findUnique({
      where: { keycloakId: session.user.id },
    })
    if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 })

    const roomName = title.trim().toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      + "-" + Math.random().toString(36).slice(2, 6)

    const room = await prisma.session.create({
      data: {
        roomName,
        title: title.trim(),
        description: description?.trim() || null,
        chatEnabled: chatEnabled ?? true,
        participationEnabled: participationEnabled ?? false,
        creatorId: user.id,
      },
    })

    return NextResponse.json({
      room: {
        ...room,
        createdAt: room.createdAt.toISOString(),
        updatedAt: room.updatedAt.toISOString(),
        startedAt: null,
        endedAt: null,
      },
    })
  } catch (err) {
    console.error("[api/rooms POST] error:", err)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
