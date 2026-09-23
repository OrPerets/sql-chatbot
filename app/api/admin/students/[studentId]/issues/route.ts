import { NextRequest, NextResponse } from 'next/server'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'
import { getStudentProfilesService } from '@/lib/student-profiles'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    await requireAdmin(_request)
    const params = await context.params
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
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

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
