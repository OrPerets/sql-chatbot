import { NextResponse } from 'next/server'

import { submitSqlCoinChallenge } from '@/lib/sql-coin-challenges'
import { resolveAuthenticatedSession } from '@/lib/session-auth'

export async function POST(
  request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  try {
    const session = await resolveAuthenticatedSession(request, 'coins.challenges.submit.POST')
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const body = await request.json()
    const answers = Array.isArray(body?.answers) ? body.answers : []
    const challenge = await submitSqlCoinChallenge({
      challengeId: params.challengeId,
      user: session.user,
      answers,
    })

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    return NextResponse.json({ challenge })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit SQL coin challenge'
    if (message.includes('answers are required')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Error submitting SQL coin challenge:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
