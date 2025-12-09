import { NextResponse } from 'next/server'
import { getAllUsers, updatePassword, createUser } from '@/lib/users'

export async function GET() {
  try {
    const users = await getAllUsers()
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Check if this is a create user request (has firstName and lastName)
    if (body.firstName && body.lastName && body.email) {
      // Create new user
      const result = await createUser({
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        password: body.password || 'shenkar',
        isFirst: body.isFirst !== undefined ? body.isFirst : true
      })
      
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to create user' }, { status: 400 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'User created successfully',
        insertedId: result.insertedId 
      })
    }
    
    // Otherwise, treat as password update request
    const emails = body.emails || body.email
    const password = body.password
    if (!emails || !password) {
      return NextResponse.json({ error: 'emails/email and password are required' }, { status: 400 })
    }
    const result = await updatePassword(emails, password)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in POST /api/users:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
