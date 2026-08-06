import { NextRequest, NextResponse } from 'next/server'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'
import { normalizeAcademicPeriodInput, parseAcademicPeriodFromSearchParams } from '@/lib/academic-period'
import { isStudentProfileInAcademicPeriod } from '@/lib/admin-student-profile-summary'
import { getAIAnalysisEngine } from '@/lib/ai-analysis-engine'
import { connectToDatabase } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { studentId, analysisType = 'manual', triggerReason = 'Manual analysis requested' } = body
    const { searchParams } = new URL(request.url)
    const academicPeriod =
      parseAcademicPeriodFromSearchParams(searchParams) ??
      normalizeAcademicPeriodInput({
        year: body.year,
        semester: body.semester,
      })

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    if (academicPeriod) {
      const { db } = await connectToDatabase()
      const isInCohort = await isStudentProfileInAcademicPeriod(db, studentId, academicPeriod)
      if (!isInCohort) {
        return NextResponse.json(
          { success: false, error: 'Student is not in the selected academic period' },
          { status: 404 }
        )
      }
    }

    // Get AI analysis engine
    const aiEngine = await getAIAnalysisEngine()

    // Perform analysis
    const analysis = await aiEngine.analyzeStudent({
      studentId,
      analysisType: analysisType as 'scheduled' | 'triggered' | 'manual',
      triggerReason
    })

    return NextResponse.json({
      success: true,
      data: analysis,
      message: 'Student analysis completed successfully'
    })

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    console.error('Error analyzing student issues:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze student issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
