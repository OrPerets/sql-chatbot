import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/homework/builder", "/admin/homework"] as const;
const SUPPORTED_LOCALES = new Set(["he", "en"]);
const DEFAULT_LOCALE = "he";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const role =
      request.headers.get("x-michael-role") ??
      request.cookies.get("michael-role")?.value ??
      "instructor"; // default to instructor for local development

    if (role !== "instructor") {
      const url = request.nextUrl.clone();
      url.pathname = "/403";
      const forbiddenResponse = NextResponse.redirect(url);
      forbiddenResponse.cookies.set("michael-locale", localeCookie, { path: "/" });
      return forbiddenResponse;
    }
  }

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
  matcher: ["/homework/builder/:path*", "/admin/homework/:path*", "/:locale(en|he)", "/:locale(en|he)/(.*)"],
};
