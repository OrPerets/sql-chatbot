import { NextRequest, NextResponse } from 'next/server'
import { getStudentProfilesService } from '@/lib/student-profiles'

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    // Get student profiles service
    const studentProfilesService = await getStudentProfilesService()

    // Get student issues
    const issues = await studentProfilesService.getStudentIssues(studentId)

    return NextResponse.json({
      success: true,
      data: issues
    })

  } catch (error) {
    console.error('Error fetching student issues:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch student issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
