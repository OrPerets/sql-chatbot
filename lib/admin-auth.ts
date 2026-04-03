import { DEFAULT_ADMIN_EMAILS } from "@/lib/admin-emails";
import { resolveAuthenticatedSession } from "@/lib/session-auth";

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function parseAdminEmailsFromEnv(raw: string | undefined): string[] | null {
  if (!raw) return null
  const emails = raw
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter((email): email is string => Boolean(email))
  return emails.length > 0 ? emails : null
}

export const ADMIN_EMAILS: string[] =
  parseAdminEmailsFromEnv(process.env.ADMIN_EMAILS) ??
  DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase())

function normalizePrivilegedRole(value: string | null | undefined): "admin" | "instructor" | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "admin") {
    return "admin";
  }

  if (["instructor", "teacher", "builder"].includes(normalized)) {
    return "instructor";
  }

  return null;
}

export async function getAdminFromRequest(
  request: Request
): Promise<{ isAdmin: boolean; email: string | null }> {
  const resolved = await resolvePrivilegedRoleFromRequest(request);
  return {
    isAdmin: resolved.role === "admin",
    email: resolved.email,
  };
}

export class AdminAuthError extends Error {
  status = 403 as const

  constructor(message: string = 'Forbidden') {
    super(message)
    this.name = 'AdminAuthError'
  }
}

export async function requireAdmin(request: Request): Promise<{ email: string }> {
  const { isAdmin, email } = await getAdminFromRequest(request)
  if (!isAdmin || !email) {
    throw new AdminAuthError('Forbidden')
  }
  return { email }
}

export async function resolvePrivilegedRoleFromRequest(
  request: Request
): Promise<{ email: string | null; role: "student" | "instructor" | "admin" }> {
  const resolvedSession = await resolveAuthenticatedSession(
    request,
    "admin-auth.resolvePrivilegedRoleFromRequest"
  );

  if (!resolvedSession) {
    return { email: null, role: 'student' };
  }

  const email =
    normalizeEmail(resolvedSession.user.email) ?? normalizeEmail(resolvedSession.session.email);

  if (email && ADMIN_EMAILS.includes(email)) {
    return { email, role: 'admin' };
  }

  const databaseRole = normalizePrivilegedRole(resolvedSession.user.role);
  if (databaseRole) {
    return { email, role: databaseRole };
  }

  const sessionRole = normalizePrivilegedRole(resolvedSession.session.role);
  if (sessionRole === 'instructor') {
    return { email, role: 'instructor' };
  }

  return { email, role: 'student' };
}

export async function requireInstructorOrAdmin(
  request: Request
): Promise<{ email: string; role: "instructor" | "admin" }> {
  const resolved = await resolvePrivilegedRoleFromRequest(request);
  if ((resolved.role !== 'admin' && resolved.role !== 'instructor') || !resolved.email) {
    throw new AdminAuthError('Forbidden');
  }

  return {
    email: resolved.email,
    role: resolved.role,
  };
}
