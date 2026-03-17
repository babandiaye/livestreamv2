import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const keycloakEnabled = process.env.KEYCLOAK_ENABLED === "true";
  if (!keycloakEnabled) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const publicPaths = ["/login", "/api/auth"];
  if (publicPaths.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const watchPublic = process.env.WATCH_PUBLIC === "true";
  if (watchPublic && pathname.startsWith("/watch")) return NextResponse.next();

  const session = await auth();
  if (!session) {
    const autoRedirect = process.env.KEYCLOAK_AUTO_REDIRECT === "true";
    const callbackUrl = encodeURIComponent(request.url);
    if (autoRedirect) {
      return NextResponse.redirect(
        new URL(`/api/auth/signin/keycloak?callbackUrl=${callbackUrl}`, request.url)
      );
    }
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${callbackUrl}`, request.url)
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-unchk.png).*)"],
};
