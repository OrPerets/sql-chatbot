import { NextRequest, NextResponse } from 'next/server'
import { getStudentActivityHistory } from '@/lib/activity-tracker'

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId: id } = params
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '50')
    const activityType = searchParams.get('activityType') || undefined

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    const activities = await getStudentActivityHistory(id, limit, activityType)

    return NextResponse.json({
      success: true,
      data: activities
    })

  } catch (error) {
    console.error('Error fetching student activity:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch student activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
