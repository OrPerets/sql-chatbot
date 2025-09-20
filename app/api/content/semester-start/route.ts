import { NextResponse } from 'next/server'
import { getSemesterStartDate, setSemesterStartDate, getCurrentWeekContent } from '@/lib/content'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const withCurrentWeek = searchParams.get('withCurrentWeek') === '1'
    const startDate = await getSemesterStartDate()
    if (withCurrentWeek && startDate) {
      const current = await getCurrentWeekContent(startDate)
      return NextResponse.json({ startDate, currentWeek: current })
    }
    return NextResponse.json({ startDate })
  } catch (error) {
    console.error('Error fetching semester start date:', error)
    return NextResponse.json({ error: 'Failed to fetch semester start date' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { startDate } = body
    if (!startDate) {
      return NextResponse.json({ error: 'startDate is required' }, { status: 400 })
    }
    const result = await setSemesterStartDate(startDate)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error setting semester start date:', error)
    return NextResponse.json({ error: 'Failed to set semester start date' }, { status: 500 })
  }
}
