import type { UserModel } from "@/lib/users";

export const SESSION_COOKIE_NAME = "michael-session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_VERSION = 1;
const DEV_FALLBACK_SESSION_SECRET = "dev-only-michael-session-secret";

export type SessionRole = "student" | "instructor" | "admin";

export type SessionPayload = {
  v: number;
  sub: string;
  email: string | null;
  role: SessionRole;
  iat: number;
  exp: number;
};

export type ResolvedSession = {
  session: SessionPayload;
  user: UserModel;
  userId: string;
};

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRole(value: string | null | undefined): SessionRole {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "admin") {
    return "admin";
  }

  if (normalized === "instructor" || normalized === "teacher" || normalized === "builder") {
    return "instructor";
  }

  return "student";
}

function getSessionSecret(): string | null {
  const explicitSecret =
    process.env.AUTH_SESSION_SECRET?.trim() || process.env.SESSION_SECRET?.trim();

  if (explicitSecret) {
    return explicitSecret;
  }

  if (process.env.NODE_ENV === "production") {
    console.error(
      "[session-auth] AUTH_SESSION_SECRET or SESSION_SECRET must be configured in production."
    );
    return null;
  }

  return DEV_FALLBACK_SESSION_SECRET;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4 || 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function sign(unsignedToken: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsignedToken));
  return toBase64Url(new Uint8Array(signature));
}

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!name) {
      continue;
    }

    cookies.set(name, decodeURIComponent(value));
  }

  return cookies;
}

function decodePayload(payloadSegment: string): SessionPayload | null {
  try {
    const payloadText = new TextDecoder().decode(fromBase64Url(payloadSegment));
    const parsed = JSON.parse(payloadText) as Partial<SessionPayload>;

    if (
      parsed.v !== SESSION_VERSION ||
      typeof parsed.sub !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    return {
      v: SESSION_VERSION,
      sub: parsed.sub,
      email: normalizeEmail(parsed.email ?? null),
      role: normalizeRole(parsed.role),
      iat: parsed.iat,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export async function createSessionToken(input: {
  userId: string;
  email?: string | null;
  role?: string | null;
  ttlSeconds?: number;
}): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("Session secret is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    v: SESSION_VERSION,
    sub: input.userId.trim(),
    email: normalizeEmail(input.email ?? null),
    role: normalizeRole(input.role ?? null),
    iat: now,
    exp: now + (input.ttlSeconds ?? SESSION_TTL_SECONDS),
  };

  const payloadSegment = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${SESSION_VERSION}.${payloadSegment}`;
  const signatureSegment = await sign(unsignedToken, secret);

  return `${unsignedToken}.${signatureSegment}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== String(SESSION_VERSION)) {
    return null;
  }

  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const expectedSignature = await sign(unsignedToken, secret);

  if (expectedSignature !== parts[2]) {
    return null;
  }

  const payload = decodePayload(parts[1]);
  if (!payload) {
    return null;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export async function readSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const token = cookies.get(SESSION_COOKIE_NAME);

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function resolveAuthenticatedSession(
  request: Request,
  context: string
): Promise<ResolvedSession | null> {
  const session = await readSessionFromRequest(request);
  if (!session) {
    return null;
  }

  const { resolveLearnerIdentity } = await import("@/lib/learner-identity");
  const identity = await resolveLearnerIdentity(session.sub, `${context}.session`);
  if (!identity.user) {
    return null;
  }

  return {
    session,
    user: identity.user,
    userId: identity.canonicalId,
  };
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  };
}
