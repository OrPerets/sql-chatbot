import { NextResponse } from 'next/server'
import { getSemesterStartDate, setSemesterStartDate, getCurrentWeekContent } from '@/lib/content'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const withCurrentWeek = searchParams.get('withCurrentWeek') === '1'
    const startDate = await getSemesterStartDate()
    
    if (withCurrentWeek && startDate) {
      const current = await getCurrentWeekContent(startDate)
      
      // Debug logging
      const now = new Date()
      const start = new Date(startDate)
      const diffMs = now.getTime() - start.getTime()
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
      const calculatedWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
      
      console.log('[semester-start] Week calculation:', {
        startDate,
        today: now.toISOString().split('T')[0],
        daysSinceStart: days,
        calculatedWeek,
        returnedWeek: current.week,
        match: calculatedWeek === current.week
      })
      
      if (calculatedWeek !== current.week) {
        console.warn(`⚠️  [semester-start] Week mismatch! Calculated: ${calculatedWeek}, Returned: ${current.week}`)
      }
      
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
