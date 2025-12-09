import { NextRequest, NextResponse } from 'next/server'
import { getStudentProfilesService } from '@/lib/student-profiles'

export async function PUT(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params
    const body = await request.json()
    const { issueId } = body

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    if (!issueId) {
      return NextResponse.json(
        { success: false, error: 'Issue ID is required' },
        { status: 400 }
      )
    }

    // Get student profiles service
    const studentProfilesService = await getStudentProfilesService()

    // Resolve the issue
    const success = await studentProfilesService.resolveIssue(studentId, issueId)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to resolve issue or issue not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Issue resolved successfully'
    })

  } catch (error) {
    console.error('Error resolving issue:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to resolve issue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
