import { NextRequest, NextResponse } from 'next/server'
import { createPasswordResetToken, checkPasswordResetRateLimit } from '@/lib/users'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    console.log('Testing forgot password for email:', email)

    // Test rate limit check
    console.log('Checking rate limit...')
    const rateLimit = await checkPasswordResetRateLimit(email)
    console.log('Rate limit result:', rateLimit)

    if (!rateLimit.allowed) {
      return NextResponse.json({ 
        error: `Too many requests. Please wait ${rateLimit.remainingTime} minutes before trying again.`,
        rateLimited: true,
        remainingTime: rateLimit.remainingTime
      }, { status: 429 })
    }

    // Test token creation
    console.log('Creating password reset token...')
    const token = await createPasswordResetToken(email)
    console.log('Token created:', token ? 'Success' : 'Failed')

    return NextResponse.json({ 
      success: true, 
      message: 'Test completed successfully',
      token: token ? 'Token created' : 'Token creation failed',
      rateLimit: rateLimit
    })

  } catch (error) {
    console.error('Error in test forgot password:', error)
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
