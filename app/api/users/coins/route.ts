import { NextResponse } from 'next/server'
import { adjustBalanceAdmin, getAllCoins, getCoinsStatus, setCoinsConfig } from '@/lib/coins'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all')
    const status = searchParams.get('status')
    if (all === '1') {
      await requireAdmin(request)
      const coins = await getAllCoins()
      return NextResponse.json(coins)
    }
    if (status === '1') {
      const statuses = await getCoinsStatus()
      const current = Array.isArray(statuses) && statuses.length > 0 ? statuses[0] : null
      return NextResponse.json({ status: (current?.status as string) || 'OFF' })
    }
    return NextResponse.json({ error: 'Specify ?all=1 or ?status=1' }, { status: 400 })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error getting coins data:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { email: adminEmail } = await requireAdmin(request)
    const body = await request.json()
    if (body.users && typeof body.amount === 'number') {
      const result = await adjustBalanceAdmin(body.users, body.amount, adminEmail)
      return NextResponse.json(result)
    }
    if (body.newStatus !== undefined) {
      const result = await setCoinsConfig({ status: body.newStatus }, adminEmail)
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error updating coins data:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

