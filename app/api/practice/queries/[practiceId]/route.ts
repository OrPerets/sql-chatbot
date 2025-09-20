import { NextResponse } from 'next/server'
import { getPracticeQueries } from '@/lib/practice'

export async function GET(request: Request, { params }: { params: { practiceId: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const max = Number(searchParams.get('max') || '3')
    const queries = await getPracticeQueries(params.practiceId, max)
    return NextResponse.json(queries)
  } catch (error) {
    console.error('Error fetching practice queries:', error)
    return NextResponse.json({ error: 'Failed to fetch practice queries' }, { status: 500 })
  }
}


