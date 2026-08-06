import { NextRequest, NextResponse } from 'next/server'
import { updateUser, updatePassword } from '@/lib/users'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ email: string }> }
) {
  try {
    await requireAdmin(request)
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
    const { firstName, lastName, email: newEmail, year, semester } = body
    
    const result = await updateUser(email, {
      firstName,
      lastName,
      email: newEmail,
      year,
      semester,
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
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error updating user:', error)
    return NextResponse.json({ 
      error: 'Failed to update user' 
    }, { status: 500 })
  }
}
