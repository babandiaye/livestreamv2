import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || !["ADMIN", "MODERATOR"].includes(session.user.role))
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })

  const { id: sessionId } = await params

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  const room = await prisma.session.findUnique({ where: { id: sessionId } })
  if (!room) return NextResponse.json({ error: "Salle introuvable" }, { status: 404 })
  if (user?.role === "MODERATOR" && room.creatorId !== user.id)
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 })

  const text = await file.text()
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0)
    return NextResponse.json({ error: "Fichier vide" }, { status: 400 })

  const sep = lines[0].includes(";") ? ";" : ","
  const firstLower = lines[0].toLowerCase()
  const hasHeader = firstLower.includes("email") || firstLower.includes("mail")
  const dataLines = hasHeader ? lines.slice(1) : lines

  const emails: string[] = []
  for (const line of dataLines) {
    const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ""))
    const email = cols.find(c => c.includes("@"))
    if (email) emails.push(email.toLowerCase())
  }

  if (emails.length === 0)
    return NextResponse.json({ error: "Aucun email valide trouvé" }, { status: 400 })

  const uniqueEmails = [...new Set(emails)]

  const users = await prisma.user.findMany({
    where: { email: { in: uniqueEmails } },
    select: { id: true, email: true },
  })
  const usersByEmail = Object.fromEntries(users.map(u => [u.email, u]))

  const existing = await prisma.enrollment.findMany({
    where: { sessionId },
    select: { userId: true },
  })
  const alreadyEnrolledIds = new Set(existing.map(e => e.userId))

  const toEnroll: string[] = []
  const skipped: string[]  = []
  const notFound: string[] = []

  for (const email of uniqueEmails) {
    const u = usersByEmail[email]
    if (!u) { notFound.push(email); continue }
    if (alreadyEnrolledIds.has(u.id)) { skipped.push(email); continue }
    toEnroll.push(u.id)
  }

  if (toEnroll.length > 0) {
    await prisma.enrollment.createMany({
      data: toEnroll.map(userId => ({
        userId,
        sessionId,
        createdBy: session.user.id,
      })),
      skipDuplicates: true,
    })
  }

  return NextResponse.json({
    summary: {
      total: uniqueEmails.length,
      enrolled: toEnroll.length,
      skipped: skipped.length,
      notFound: notFound.length,
    },
    notFound,
    skipped,
  })
}
