import { auth } from "@/auth"
import { redirect } from "next/navigation"
import DashboardClient from "./dashboard.client"

export default async function HomePage() {
  const session = await auth()
  if (!session) redirect("/login")
  return <DashboardClient user={session.user} />
}
