import { NextResponse } from 'next/server'
import { executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await executeWithRetry(async (db) => {
      await db.collection(COLLECTIONS.USER_FORMS).insertOne(body)
    })
    return NextResponse.json({ status: 1 })
  } catch (error) {
    console.error('Error saving user form:', error)
    return NextResponse.json({ status: 0 }, { status: 500 })
  }
}
