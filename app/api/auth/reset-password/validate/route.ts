import { NextRequest, NextResponse } from 'next/server'
import { validatePasswordResetToken } from '@/lib/users'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const validation = await validatePasswordResetToken(token)
    
    if (!validation.valid) {
      return NextResponse.json({ 
        valid: false, 
        error: validation.error 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      valid: true, 
      email: validation.email 
    })

  } catch (error) {
    console.error('Error validating reset token:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
