import { DEFAULT_ADMIN_EMAILS } from "@/lib/admin-emails";
import { getUsersService } from "@/lib/users";

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

function readCookie(request: Request, cookieName: string): string | null {
  const rawCookies = request.headers.get('cookie');
  if (!rawCookies) {
    return null;
  }

  const cookie = rawCookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(cookieName.length + 1));
}

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

export function getAdminFromRequest(request: Request): { isAdmin: boolean; email: string | null } {
  const email =
    normalizeEmail(request.headers.get('x-user-email')) ??
    normalizeEmail(request.headers.get('x-admin-email'))

  if (!email) {
    return { isAdmin: false, email: null }
  }

  return { isAdmin: ADMIN_EMAILS.includes(email), email }
}

export class AdminAuthError extends Error {
  status = 403 as const

  constructor(message: string = 'Forbidden') {
    super(message)
    this.name = 'AdminAuthError'
  }
}

export async function requireAdmin(request: Request): Promise<{ email: string }> {
  const { isAdmin, email } = getAdminFromRequest(request)
  if (!isAdmin || !email) {
    throw new AdminAuthError('Forbidden')
  }
  return { email }
}

export async function resolvePrivilegedRoleFromRequest(
  request: Request
): Promise<{ email: string | null; role: "student" | "instructor" | "admin" }> {
  const email =
    normalizeEmail(request.headers.get('x-user-email')) ??
    normalizeEmail(request.headers.get('x-admin-email'));

  if (!email) {
    return { email: null, role: 'student' };
  }

  if (ADMIN_EMAILS.includes(email)) {
    return { email, role: 'admin' };
  }

  const hintedRole =
    normalizePrivilegedRole(request.headers.get('x-user-role')) ??
    normalizePrivilegedRole(readCookie(request, 'michael-role'));

  if (hintedRole === 'instructor') {
    return { email, role: 'instructor' };
  }

  if (hintedRole === 'admin') {
    return { email, role: 'admin' };
  }

  try {
    const usersService = await getUsersService();
    const user = await usersService.getUserByEmail(email);
    const databaseRole = normalizePrivilegedRole(user?.role);
    if (databaseRole) {
      return { email, role: databaseRole };
    }
  } catch (error) {
    console.warn(
      '[admin-auth] failed to resolve privileged role from user record:',
      error instanceof Error ? error.message : error
    );
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
