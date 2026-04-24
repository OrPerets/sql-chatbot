import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasBlockedNextResumeHeader } from "@/lib/security/next-resume";
import { readSessionFromRequest } from "@/lib/session-auth";

const ADMIN_PAGE_PREFIXES = ["/admin", "/homework/builder"] as const;
const ADMIN_API_PREFIX = "/api/admin";
const SUPPORTED_LOCALES = new Set(["he", "en"]);
const DEFAULT_LOCALE = "he";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (hasBlockedNextResumeHeader(request.headers)) {
    return NextResponse.json(
      { error: "Forbidden resume header from external clients" },
      { status: 400 },
    );
  }

  // Allow public access to manifest.json and other public assets
  if (pathname === "/manifest.json" || pathname.startsWith("/_next/") || pathname.startsWith("/icon-")) {
    return NextResponse.next();
  }

  const segments = pathname.split("/");
  const potentialLocale = segments[1]?.toLowerCase();

  if (potentialLocale && SUPPORTED_LOCALES.has(potentialLocale)) {
    const url = request.nextUrl.clone();
    const remaining = segments.slice(2).filter(Boolean).join("/");
    url.pathname = remaining ? `/${remaining}` : "/";
    const localeRedirect = NextResponse.redirect(url);
    localeRedirect.cookies.set("michael-locale", potentialLocale, { path: "/" });
    return localeRedirect;
  }

  const localeCookie = request.cookies.get("michael-locale")?.value ?? DEFAULT_LOCALE;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-michael-locale", localeCookie);

  const session = await readSessionFromRequest(request);
  const sessionRole = session?.role ?? "guest";

  if (pathname.startsWith(ADMIN_API_PREFIX) && sessionRole !== "admin") {
    const status = session ? 403 : 401;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Forbidden" },
      { status },
    );
  }

  if (ADMIN_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && sessionRole !== "admin") {
    if (session) {
      const url = request.nextUrl.clone();
      url.pathname = "/403";
      const forbiddenResponse = NextResponse.redirect(url);
      forbiddenResponse.cookies.set("michael-locale", localeCookie, { path: "/" });
      return forbiddenResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const loginResponse = NextResponse.redirect(url);
    loginResponse.cookies.set("michael-locale", localeCookie, { path: "/" });
    return loginResponse;
  }

  if (session?.sub) {
    requestHeaders.set("x-michael-authenticated-user-id", session.sub);
  }
  requestHeaders.set("x-michael-authenticated-role", sessionRole);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (!request.cookies.get("michael-locale")) {
    response.cookies.set("michael-locale", localeCookie, { path: "/" });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
