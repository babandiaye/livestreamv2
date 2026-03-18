import NextAuth, { type DefaultSession } from "next-auth"
import Keycloak from "next-auth/providers/keycloak"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

declare module "next-auth" {
  interface Session extends DefaultSession {
    id_token?: string
    user: {
      id: string
      role: Role
    } & DefaultSession["user"]
  }
}

function mapKeycloakRoleToAppRole(roles: string[]): Role {
  if (roles.includes("livestream-admin")) return Role.ADMIN
  if (roles.includes("livestream-moderator")) return Role.MODERATOR
  return Role.VIEWER
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.access_token = account.access_token
        token.id_token = account.id_token

        const p = profile as any
        const clientRoles: string[] =
          p?.resource_access?.[process.env.KEYCLOAK_CLIENT_ID!]?.roles ?? []
        const realmRoles: string[] =
          p?.realm_access?.roles ?? []
        const appRole = mapKeycloakRoleToAppRole([...clientRoles, ...realmRoles])

        try {
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { keycloakId: token.sub! },
                { email: token.email ?? "" },
              ],
            },
          })

          if (existingUser) {
            const keepRole =
              appRole === Role.VIEWER && existingUser.role !== Role.VIEWER
                ? existingUser.role
                : appRole

            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                keycloakId: token.sub!,
                email: token.email ?? "",
                name: token.name ?? "",
                role: keepRole,
              },
            })
            token.appRole = keepRole
          } else {
            await prisma.user.create({
              data: {
                keycloakId: token.sub!,
                email: token.email ?? "",
                name: token.name ?? "",
                role: appRole,
              },
            })
            token.appRole = appRole
          }
        } catch (e) {
          console.error("Erreur sync user:", e)
          token.appRole = appRole
        }
      }
      return token
    },
    async session({ session, token }) {
      session.id_token = token.id_token as string | undefined
      session.user.id = token.sub ?? ""
      session.user.role = (token.appRole as Role) ?? Role.VIEWER
      return session
    },
  },
  events: {
    async signOut(message) {
      if ("token" in message && message.token?.id_token) {
        const logoutUrl = new URL(
          `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`
        )
        logoutUrl.searchParams.set("id_token_hint", message.token.id_token as string)
        logoutUrl.searchParams.set(
          "post_logout_redirect_uri",
          process.env.NEXT_PUBLIC_SITE_URL!
        )
        await fetch(logoutUrl.toString())
      }
    },
  },
  pages: { signIn: "/login" },
})
