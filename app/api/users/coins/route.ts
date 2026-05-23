import { NextResponse } from 'next/server'
import { adjustBalanceAdmin, getCoinsAdminOverview, getCoinsConfig, setCoinsConfig } from '@/lib/coins'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'

function buildCoinsConfigPatch(body: any) {
  const source =
    body?.config && typeof body.config === 'object' ? { ...body, ...body.config, config: undefined } : body
  const patch: Record<string, unknown> = {}

  if (source?.newStatus !== undefined || source?.status !== undefined) {
    patch.status = source?.newStatus ?? source?.status
  }
  if (source?.starterBalance !== undefined) {
    patch.starterBalance = source.starterBalance
  }
  if (source?.messageCost !== undefined) {
    patch.messageCost = source.messageCost
  }
  if (source?.costs && typeof source.costs === 'object') {
    patch.costs = source.costs
  }
  if (source?.modules && typeof source.modules === 'object') {
    patch.modules = source.modules
  }

  return Object.keys(patch).length > 0 ? patch : null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all')
    const status = searchParams.get('status')
    if (all === '1') {
      await requireAdmin(request)
      const overview = await getCoinsAdminOverview()
      return NextResponse.json(overview)
    }
    if (status === '1') {
      const config = await getCoinsConfig()
      return NextResponse.json(config)
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
    const configPatch = buildCoinsConfigPatch(body)
    if (configPatch) {
      const result = await setCoinsConfig(configPatch, adminEmail)
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
