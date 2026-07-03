import { NextResponse } from 'next/server'

import { getSqlCoinChallengeForStudent } from '@/lib/sql-coin-challenges'
import { resolveAuthenticatedSession } from '@/lib/session-auth'

export async function GET(
  request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  try {
    const session = await resolveAuthenticatedSession(request, 'coins.challenges.detail.GET')
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const challenge = await getSqlCoinChallengeForStudent(params.challengeId, session.user)
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    return NextResponse.json({ challenge })
  } catch (error) {
    console.error('Error loading SQL coin challenge:', error)
    return NextResponse.json({ error: 'Failed to load SQL coin challenge' }, { status: 500 })
  }
}
