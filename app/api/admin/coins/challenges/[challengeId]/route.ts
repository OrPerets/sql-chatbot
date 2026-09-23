import { NextResponse } from 'next/server'

import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'
import { normalizeAcademicPeriodInput } from '@/lib/academic-period'
import { updateSqlCoinChallengeStatus } from '@/lib/sql-coin-challenges'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  try {
    await requireAdmin(request)
    const params = await context.params
    const body = await request.json()
    const status = body?.status === 'active' || body?.status === 'cancelled' ? body.status : null
    const academicPeriod = normalizeAcademicPeriodInput({
      year: body?.year,
      semester: body?.semester,
    })

    if (!status || !academicPeriod) {
      return NextResponse.json({ error: 'status, year, and semester are required' }, { status: 400 })
    }

    const challenge = await updateSqlCoinChallengeStatus(params.challengeId, status, academicPeriod)
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found for selected cohort/status' }, { status: 404 })
    }

    return NextResponse.json({ challenge })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error updating SQL coin challenge:', error)
    return NextResponse.json({ error: 'Failed to update SQL coin challenge' }, { status: 500 })
  }
}
