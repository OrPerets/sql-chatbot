import { NextResponse } from 'next/server'
import { getAllUsers, updatePassword, createUser, getUsersService } from '@/lib/users'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'

function sanitizeUser(user: any) {
  const { password, ...safeUser } = user
  return safeUser
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const users = await getAllUsers()
    return NextResponse.json(users.map(sanitizeUser))
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    let admin = false
    try {
      await requireAdmin(request)
      admin = true
    } catch (error) {
      if (!(error instanceof AdminAuthError)) {
        throw error
      }
    }
    
    // Check if this is a create user request (has firstName and lastName)
    if (body.firstName && body.lastName && body.email) {
      if (!admin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
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

    if (!admin) {
      if (Array.isArray(emails) || typeof body.currentPassword !== 'string') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const usersService = await getUsersService()
      const existingUser = await usersService.getUserByEmail(String(emails).toLowerCase().trim())
      if (!existingUser || existingUser.password !== body.currentPassword || body.currentPassword !== 'shenkar') {
        return NextResponse.json({ error: 'Invalid password change request' }, { status: 403 })
      }
    }

    const result = await updatePassword(emails, password)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in POST /api/users:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
