import { NextRequest, NextResponse } from 'next/server'
import { analyzeConversation } from '@/lib/conversation-summary'
import { getChatMessages } from '@/lib/chat'
import { getChatSessions } from '@/lib/chat'

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    const body = await request.json()
    const { userId, sessionTitle } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
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

    // Get session title if not provided
    let finalSessionTitle = sessionTitle
    if (!finalSessionTitle) {
      try {
        const sessions = await getChatSessions(userId)
        const session = sessions.find(s => s._id?.toString() === sessionId)
        finalSessionTitle = session?.title || 'Chat Session'
      } catch (error) {
        finalSessionTitle = 'Chat Session'
      }
    }

    // Calculate session duration (from first to last message)
    const sessionDuration = messages.length > 1 
      ? Math.round((messages[messages.length - 1].timestamp.getTime() - messages[0].timestamp.getTime()) / (1000 * 60))
      : 0

    // Prepare analysis request
    const analysisRequest = {
      userId,
      sessionId,
      sessionTitle: finalSessionTitle,
      messages: messages.map(msg => ({
        role: (msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user') as 'user' | 'assistant',
        text: msg.text,
        timestamp: msg.timestamp
      })),
      sessionDuration
    }

    // Analyze conversation
    const summary = await analyzeConversation(analysisRequest)

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
