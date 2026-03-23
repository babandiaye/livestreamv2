import { auth } from "@/auth"
import { redirect } from "next/navigation"
import ModeratorClient from "./moderator.client"

export default async function ModeratorPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "MODERATOR") redirect("/")
  return <ModeratorClient user={session.user} />
}
