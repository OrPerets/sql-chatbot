import { NextRequest, NextResponse } from 'next/server'
import { getStudentProfile, updateKnowledgeScore } from '@/lib/student-profiles'

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId: id } = params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    const profile = await getStudentProfile(id)

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Student profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: profile
    })

  } catch (error) {
    console.error('Error fetching student profile:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch student profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId: id } = params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    const { knowledgeScore, reason, updatedBy } = body

    if (!knowledgeScore || !reason || !updatedBy) {
      return NextResponse.json(
        { success: false, error: 'knowledgeScore, reason, and updatedBy are required' },
        { status: 400 }
      )
    }

    const success = await updateKnowledgeScore(id, knowledgeScore, reason, updatedBy)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update knowledge score' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Knowledge score updated successfully'
    })

  } catch (error) {
    console.error('Error updating student profile:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update student profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
