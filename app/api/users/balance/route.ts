import { NextResponse } from 'next/server'
import { getCoinsBalance, setCoinsBalance } from '@/lib/users'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'
import { resolveAuthenticatedSession } from '@/lib/session-auth'

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

async function canReadBalance(request: Request, email: string): Promise<boolean> {
  try {
    await requireAdmin(request)
    return true
  } catch (error) {
    if (!(error instanceof AdminAuthError)) {
      throw error
    }
  }

  const session = await resolveAuthenticatedSession(request, 'users.balance.GET')
  const sessionEmail = normalizeEmail(session?.user.email ?? session?.session.email)
  return Boolean(sessionEmail && sessionEmail === normalizeEmail(email))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    if (!(await canReadBalance(request, email))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const result = await getCoinsBalance(email)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error getting coins balance:', error)
    return NextResponse.json({ error: 'Failed to get coins balance' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Admin-only manual balance updates; chat billing must go through /api/responses/messages.
    await requireAdmin(request)
    const body = await request.json()
    const email = body.email
    const currentBalance = body.currentBalance
    if (!email || typeof currentBalance !== 'number') {
      return NextResponse.json({ error: 'email and currentBalance required' }, { status: 400 })
    }
    const result = await setCoinsBalance(email, currentBalance)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error setting coins balance:', error)
    return NextResponse.json({ error: 'Failed to set coins balance' }, { status: 500 })
  }
}
