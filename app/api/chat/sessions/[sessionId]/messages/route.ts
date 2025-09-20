import { NextResponse } from 'next/server'
import { getChatMessages, saveChatMessage } from '@/lib/chat'

export async function GET(_request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params
    const messages = await getChatMessages(sessionId)
    return NextResponse.json(messages)
  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  try {
    const { sessionId } = params
    const body = await request.json()
    const role = body.role
    const text = body.message || body.text
    if (!role || !text) {
      return NextResponse.json({ error: 'role and message are required' }, { status: 400 })
    }
    const message = await saveChatMessage(sessionId, role, text)
    return NextResponse.json(message)
  } catch (error) {
    console.error('Error saving chat message:', error)
    return NextResponse.json({ error: 'Failed to save chat message' }, { status: 500 })
  }
}
