import { NextResponse } from 'next/server'

import { getCurrentSqlCoinChallengeForStudent } from '@/lib/sql-coin-challenges'
import { resolveAuthenticatedSession } from '@/lib/session-auth'

export async function GET(request: Request) {
  try {
    const session = await resolveAuthenticatedSession(request, 'coins.challenges.me.GET')
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const challenge = await getCurrentSqlCoinChallengeForStudent(session.user)
    return NextResponse.json({ challenge })
  } catch (error) {
    console.error('Error loading current SQL coin challenge:', error)
    return NextResponse.json({ error: 'Failed to load SQL coin challenge' }, { status: 500 })
  }
}
