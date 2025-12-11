import { NextRequest, NextResponse } from 'next/server'
import { analyzeConversation } from '@/lib/conversation-summary'
import { getChatMessages } from '@/lib/chat'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, userId, sessionTitle } = body

    if (!sessionId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Session ID and User ID are required' },
        { status: 400 }
      )
    }

    // Get chat messages for the session
    const messages = await getChatMessages(sessionId)
    
    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages found for this session' },
        { status: 404 }
      )
    }

    // Calculate session duration (simplified - from first to last message)
    const sessionDuration = messages.length > 1 
      ? Math.round((messages[messages.length - 1].timestamp.getTime() - messages[0].timestamp.getTime()) / (1000 * 60))
      : 0

    // Prepare analysis request
    const analysisRequest = {
      userId,
      sessionId,
      sessionTitle: sessionTitle || 'Chat Session',
      messages: messages.map(msg => ({
        role: (msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user') as 'user' | 'assistant',
        text: msg.text,
        timestamp: msg.timestamp
      })),
      sessionDuration
    }

    // Analyze conversation
    const summary = await analyzeConversation(analysisRequest)

    // Update student profile with conversation insights
    try {
      const { updateStudentProfileFromConversations } = await import('@/lib/conversation-profile-updater')
      await updateStudentProfileFromConversations(userId)
    } catch (profileUpdateError) {
      console.error('Error updating student profile:', profileUpdateError)
      // Don't fail the main request if profile update fails
    }

    return NextResponse.json({
      success: true,
      data: summary,
      message: 'Conversation analyzed successfully'
    })

  } catch (error) {
    console.error('Error analyzing conversation:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
