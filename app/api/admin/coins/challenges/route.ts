import { NextResponse } from 'next/server'

import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'
import { normalizeAcademicPeriodInput, parseAcademicPeriodFromSearchParams } from '@/lib/academic-period'
import { createSqlCoinChallenge, listSqlCoinChallenges } from '@/lib/sql-coin-challenges'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const academicPeriod = parseAcademicPeriodFromSearchParams(searchParams)

    if (!academicPeriod) {
      return NextResponse.json({ error: 'year and semester are required' }, { status: 400 })
    }

    const challenges = await listSqlCoinChallenges(academicPeriod)
    return NextResponse.json({ challenges })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error listing SQL coin challenges:', error)
    return NextResponse.json({ error: 'Failed to list SQL coin challenges' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { email: adminEmail } = await requireAdmin(request)
    const body = await request.json()
    const studentEmail = typeof body?.studentEmail === 'string' ? body.studentEmail.trim().toLowerCase() : ''
    const academicPeriod = normalizeAcademicPeriodInput({
      year: body?.year,
      semester: body?.semester,
    })

    if (!studentEmail || !academicPeriod) {
      return NextResponse.json({ error: 'studentEmail, year, and semester are required' }, { status: 400 })
    }

    const challenge = await createSqlCoinChallenge({
      studentEmail,
      academicPeriod,
      createdBy: adminEmail,
      questionCount: typeof body?.questionCount === 'number' ? body.questionCount : undefined,
      practiceId: typeof body?.practiceId === 'string' && body.practiceId.trim() ? body.practiceId.trim() : undefined,
    })

    return NextResponse.json({ challenge })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const message = error instanceof Error ? error.message : 'Failed to create SQL coin challenge'
    if (message.includes('selected cohort')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('Not enough')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    console.error('Error creating SQL coin challenge:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
