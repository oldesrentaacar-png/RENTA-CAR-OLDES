import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

const STATIC_PATH_PREFIXES = ["/_next", "/favicon.ico"];

function isStaticAsset(pathname: string): boolean {
  if (STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);

  if (pathname.startsWith("/dashboard") && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
