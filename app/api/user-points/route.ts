import { NextResponse } from 'next/server'
import { executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    const doc = await executeWithRetry(async (db) => {
      const points = await db.collection(COLLECTIONS.USER_POINTS).findOne({ userId: email })
      return points || { userId: email, points: 0, answeredExercises: [], failedAttempts: {} }
    })
    return NextResponse.json(doc)
  } catch (error) {
    console.error('Error fetching user points:', error)
    return NextResponse.json({ error: 'Failed to fetch user points' }, { status: 500 })
  }
}


