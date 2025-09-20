import { NextResponse } from 'next/server'
import { submitPracticeAnswer } from '@/lib/practice'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, queryId, answer } = body
    if (!userId || !queryId || !answer) {
      return NextResponse.json({ error: 'userId, queryId, and answer are required' }, { status: 400 })
    }
    const result = await submitPracticeAnswer(userId, queryId, answer)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error submitting practice answer:', error)
    return NextResponse.json({ error: 'Failed to submit practice answer' }, { status: 500 })
  }
}


