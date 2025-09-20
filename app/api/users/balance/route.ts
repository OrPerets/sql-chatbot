import { NextResponse } from 'next/server'
import { getCoinsBalance, setCoinsBalance } from '@/lib/users'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    const result = await getCoinsBalance(email)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error getting coins balance:', error)
    return NextResponse.json({ error: 'Failed to get coins balance' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = body.email
    const currentBalance = body.currentBalance
    if (!email || typeof currentBalance !== 'number') {
      return NextResponse.json({ error: 'email and currentBalance required' }, { status: 400 })
    }
    const result = await setCoinsBalance(email, currentBalance)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error setting coins balance:', error)
    return NextResponse.json({ error: 'Failed to set coins balance' }, { status: 500 })
  }
}
