import { NextRequest, NextResponse } from 'next/server'
import { checkPasswordResetRateLimit } from '@/lib/users'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const rateLimit = await checkPasswordResetRateLimit(email)
    
    return NextResponse.json({
      email,
      rateLimit,
      message: rateLimit.allowed 
        ? 'Rate limit OK - you can request password reset'
        : `Rate limit exceeded - wait ${rateLimit.remainingTime} minutes`
    })

  } catch (error) {
    console.error('Error checking rate limit:', error)
    return NextResponse.json({ 
      error: 'Failed to check rate limit',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
