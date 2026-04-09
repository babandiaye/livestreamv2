import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const egressId = req.nextUrl.searchParams.get("egressId")
  if (!egressId) {
    return NextResponse.json({ error: "egressId requis" }, { status: 400 })
  }

  const recording = await prisma.recording.findFirst({
    where: { egressId },
    select: { status: true },
  })

  if (!recording) {
    return NextResponse.json({ status: "NOT_FOUND" })
  }

  return NextResponse.json({ status: recording.status })
}
