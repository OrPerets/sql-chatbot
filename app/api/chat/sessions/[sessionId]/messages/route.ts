import { NextResponse } from 'next/server'
import { getChatMessages, saveChatMessage } from '@/lib/chat'

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const params = await context.params
    const { sessionId } = params
    const messages = await getChatMessages(sessionId)
    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const params = await context.params
    const { sessionId } = params
    const body = await request.json()
    const role = body.role
    const text = body.message || body.text
    const userId = body.userId
    
    if (!role || !text) {
      return NextResponse.json({ error: 'role and message are required' }, { status: 400 })
    }
    
    const message = await saveChatMessage(sessionId, role, text)
    
    // Track student activity for AI analysis (Sprint 3)
    if (userId && role === 'user') {
      try {
        const { trackStudentQuestion, trackStudentHelpRequest } = await import('@/lib/data-collection-hooks')
        
        // Analyze message for topic and help request indicators
        const topic = extractTopicFromMessage(text)
        const isHelpRequest = detectHelpRequest(text)
        
        if (isHelpRequest) {
          await trackStudentHelpRequest(userId, 'chat_help_request')
        } else {
          await trackStudentQuestion(userId, text, topic)
        }
      } catch (trackingError) {
        console.error('Error tracking student activity:', trackingError)
        // Don't fail the main request if tracking fails
      }
    }
    
    return NextResponse.json(message)
  } catch (error) {
    console.error('Error saving chat message:', error)
    return NextResponse.json({ error: 'Failed to save chat message' }, { status: 500 })
  }
}

// Helper functions for message analysis
function extractTopicFromMessage(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('join') || lowerMessage.includes('מחבר')) {
    return 'joins'
  } else if (lowerMessage.includes('group by') || lowerMessage.includes('aggregat') || lowerMessage.includes('סכום')) {
    return 'aggregations'
  } else if (lowerMessage.includes('subquery') || lowerMessage.includes('תת-שאילתה')) {
    return 'subqueries'
  } else if (lowerMessage.includes('select') || lowerMessage.includes('בחר')) {
    return 'basic_select'
  } else if (lowerMessage.includes('create') || lowerMessage.includes('יצור')) {
    return 'ddl'
  } else if (lowerMessage.includes('insert') || lowerMessage.includes('הכנס')) {
    return 'dml'
  } else {
    return 'general_sql'
  }
}

function detectHelpRequest(message: string): boolean {
  const helpKeywords = ['help', 'עזרה', 'explain', 'הסבר', 'how to', 'איך', 'tutorial', 'מדריך']
  const lowerMessage = message.toLowerCase()
  return helpKeywords.some(keyword => lowerMessage.includes(keyword))
}
