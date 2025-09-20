import { NextResponse } from 'next/server'
import { getAllUsers, updatePassword } from '@/lib/users'

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
    const emails = body.emails || body.email
    const password = body.password
    if (!emails || !password) {
      return NextResponse.json({ error: 'emails/email and password are required' }, { status: 400 })
    }
    const result = await updatePassword(emails, password)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating password:', error)
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}
