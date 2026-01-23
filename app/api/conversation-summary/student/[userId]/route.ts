import { NextRequest, NextResponse } from 'next/server'
import { getStudentConversationSummaries, getStudentConversationInsights } from '@/lib/conversation-summary'
import { requireAuthenticatedUser } from '@/lib/request-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const includeInsights = searchParams.get('insights') === 'true'
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    const authResult = await requireAuthenticatedUser(request, userId)
    if (!authResult.ok) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      )
    }

    // Get conversation summaries
    const summaries = await getStudentConversationSummaries(userId, limit)

    let insights = null
    if (includeInsights) {
      insights = await getStudentConversationInsights(userId)
    }

    return NextResponse.json({
      success: true,
      data: {
        summaries,
        insights,
        total: summaries.length
      },
      message: 'Conversation summaries retrieved successfully'
    })

  } catch (error) {
    console.error('Error getting conversation summaries:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get conversation summaries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
