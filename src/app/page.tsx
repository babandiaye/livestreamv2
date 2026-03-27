import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "VIEWER") redirect("/student")
  if (session.user.role === "MODERATOR") redirect("/moderator")
  redirect("/admin")
}
