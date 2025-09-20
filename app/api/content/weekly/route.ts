import { NextResponse } from 'next/server'
import { getWeeklyContent, setWeeklyContent } from '@/lib/content'

export async function GET() {
  try {
    const content = await getWeeklyContent()
    return NextResponse.json(content)
  } catch (error) {
    console.error('Error fetching weekly content:', error)
    return NextResponse.json({ error: 'Failed to fetch weekly content' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { week, content, dateRange, updatedBy } = body
    if (!week || week < 1 || week > 14) {
      return NextResponse.json({ error: 'Week must be between 1 and 14' }, { status: 400 })
    }
    const result = await setWeeklyContent({ week, content: content || '', dateRange: dateRange || '', updatedBy: updatedBy || 'admin' })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error saving weekly content:', error)
    return NextResponse.json({ error: 'Failed to save weekly content' }, { status: 500 })
  }
}
