import { NextResponse } from 'next/server'
import { getChatSessions, createChatSession } from '@/lib/chat'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    const sessions = await getChatSessions(userId)
    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching chat sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch chat sessions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const userId = body.user || body.userId
    const title = body.title || 'New chat'
    const openaiSessionId =
      typeof body.openaiSessionId === 'string' && body.openaiSessionId.trim()
        ? body.openaiSessionId.trim()
        : null
    const promptCacheKey =
      typeof body.promptCacheKey === 'string' && body.promptCacheKey.trim()
        ? body.promptCacheKey.trim()
        : null
    const safetyIdentifier =
      typeof body.safetyIdentifier === 'string' && body.safetyIdentifier.trim()
        ? body.safetyIdentifier.trim()
        : null
    if (!userId) {
      return NextResponse.json({ error: 'user is required' }, { status: 400 })
    }
    const session = await createChatSession(userId, title, {
      openaiState: openaiSessionId
        ? {
            sessionId: openaiSessionId,
            lastResponseId: null,
            canonicalStateStrategy: 'previous_response_id',
            store: true,
            truncation: 'auto',
            promptCacheKey,
            safetyIdentifier,
            updatedAt: new Date(),
          }
        : undefined,
    })
    return NextResponse.json(session)
  } catch (error) {
    console.error('Error creating chat session:', error)
    return NextResponse.json({ error: 'Failed to create chat session' }, { status: 500 })
  }
}
