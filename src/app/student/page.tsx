import { auth } from "@/auth"
import { redirect } from "next/navigation"
import StudentClient from "./student.client"

export default async function StudentPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "VIEWER") redirect("/")
  return <StudentClient user={session.user} />
}
