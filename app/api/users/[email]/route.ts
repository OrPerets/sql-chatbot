import { NextRequest, NextResponse } from 'next/server'
import { updateUser, updatePassword } from '@/lib/users'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ email: string }> }
) {
  try {
    const params = await context.params
    const email = decodeURIComponent(params.email)
    const body = await request.json()
    
    // Check if this is a password reset request
    if (body.password !== undefined) {
      const result = await updatePassword(email, body.password)
      return NextResponse.json({ 
        success: true, 
        modifiedCount: result.modifiedCount 
      })
    }
    
    // Otherwise, update user info
    const { firstName, lastName, email: newEmail } = body
    
    const result = await updateUser(email, {
      firstName,
      lastName,
      email: newEmail
    })
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to update user' 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      success: true, 
      modifiedCount: result.modifiedCount 
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ 
      error: 'Failed to update user' 
    }, { status: 500 })
  }
}
