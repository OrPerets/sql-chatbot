const DEFAULT_ADMIN_EMAILS = [
  'liorbs89@gmail.com',
  'eyalh747@gmail.com',
  'orperets11@gmail.com',
  'roeizer@shenkar.ac.il',
  'r_admin@gmail.com',
] as const

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
