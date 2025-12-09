import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') || undefined

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    const analyses = await executeWithRetry(async (db) => {
      const filter: any = { studentId }
      if (type) {
        filter.analysisType = type
      }

      const results = await db.collection(COLLECTIONS.ANALYSIS_RESULTS)
        .find(filter)
        .sort({ analysisDate: -1 })
        .skip(offset)
        .limit(limit)
        .toArray()

      return results
    })

    return NextResponse.json({
      success: true,
      data: analyses,
      message: 'Analysis history retrieved successfully'
    })

  } catch (error) {
    console.error('Error fetching analysis history:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch analysis history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
