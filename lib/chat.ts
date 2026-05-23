import { Db, ObjectId } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'
import type { ResponseCitation, ResponseTurnMetadata } from '@/lib/openai/contracts'

export interface ChatSession {
  _id?: ObjectId
  userId: string
  title: string
  createdAt: Date
  lastMessageTimestamp: Date
  openaiState?: {
    sessionId?: string | null
    lastResponseId?: string | null
    canonicalStateStrategy: 'previous_response_id'
    store?: boolean
    truncation?: string | null
    promptCacheKey?: string | null
    safetyIdentifier?: string | null
    updatedAt: Date
  }
}

export interface ChatMessage {
  _id?: ObjectId
  chatId: ObjectId
  role: 'user' | 'assistant' | string
  text: string
  timestamp: Date
  structuredContent?: Record<string, unknown> | null
  citations?: ResponseCitation[]
  metadata?: ResponseTurnMetadata | null
}

export class ChatService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  async getChatSessions(userId: string): Promise<ChatSession[]> {
    return executeWithRetry(async (db) => {
      return db.collection<ChatSession>(COLLECTIONS.CHAT_SESSIONS)
        .find({ userId })
        .sort({ lastMessageTimestamp: -1 })
        .toArray()
    })
  }

  async createChatSession(
    userId: string,
    title: string,
    options?: {
      openaiState?: ChatSession['openaiState']
    }
  ): Promise<ChatSession> {
    const session: ChatSession = {
      userId,
      title,
      createdAt: new Date(),
      lastMessageTimestamp: new Date(),
      openaiState: options?.openaiState,
    }
    return executeWithRetry(async (db) => {
      const res = await db.collection<ChatSession>(COLLECTIONS.CHAT_SESSIONS).insertOne(session)
      return { _id: res.insertedId, ...session }
    })
  }

  async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    return executeWithRetry(async (db) => {
      const objectId = new ObjectId(chatId)
      return db
        .collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES)
        .find({ chatId: objectId })
        .sort({ timestamp: 1 })
        .toArray()
    })
  }

  async saveChatMessage(
    chatId: string,
    role: string,
    text: string,
    options?: {
      structuredContent?: Record<string, unknown> | null
      citations?: ResponseCitation[]
      metadata?: ResponseTurnMetadata | null
    }
  ): Promise<ChatMessage> {
    const message: ChatMessage = {
      chatId: new ObjectId(chatId),
      role: role as any,
      text,
      timestamp: new Date(),
      structuredContent: options?.structuredContent || null,
      citations: options?.citations || [],
      metadata: options?.metadata || null,
    }
    return executeWithRetry(async (db) => {
      await db.collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES).insertOne(message)
      const nextOpenAIState =
        role === 'assistant' && options?.metadata?.sessionId
          ? {
              sessionId: options.metadata.sessionId,
              lastResponseId: options.metadata.responseId || null,
              canonicalStateStrategy: 'previous_response_id' as const,
              store: options.metadata.store,
              truncation: options.metadata.truncation || null,
              promptCacheKey: options.metadata.promptCacheKey || null,
              safetyIdentifier: options.metadata.safetyIdentifier || null,
              updatedAt: new Date(),
            }
          : undefined

      await db
        .collection<ChatSession>(COLLECTIONS.CHAT_SESSIONS)
        .updateOne(
          { _id: new ObjectId(chatId) },
          {
            $set: {
              lastMessageTimestamp: new Date(),
              ...(nextOpenAIState ? { openaiState: nextOpenAIState } : {}),
            },
          }
        )
      return message
    })
  }

  async updateChatSessionOpenAIState(
    chatId: string,
    openaiState: NonNullable<ChatSession['openaiState']>
  ): Promise<void> {
    await executeWithRetry(async (db) => {
      await db.collection<ChatSession>(COLLECTIONS.CHAT_SESSIONS).updateOne(
        { _id: new ObjectId(chatId) },
        {
          $set: {
            openaiState,
            lastMessageTimestamp: new Date(),
          },
        }
      )
      return true
    })
  }
}

let chatService: ChatService | null = null

export async function getChatService(): Promise<ChatService> {
  if (!chatService) {
    const { db } = await connectToDatabase()
    chatService = new ChatService(db)
  }
  return chatService
}

export async function getChatSessions(userId: string) {
  const service = await getChatService()
  return service.getChatSessions(userId)
}

export async function createChatSession(
  userId: string,
  title: string,
  options?: {
    openaiState?: ChatSession['openaiState']
  }
) {
  const service = await getChatService()
  return service.createChatSession(userId, title, options)
}

export async function getChatMessages(chatId: string) {
  const service = await getChatService()
  return service.getChatMessages(chatId)
}

export async function saveChatMessage(
  chatId: string,
  role: string,
  text: string,
  options?: {
    structuredContent?: Record<string, unknown> | null
    citations?: ResponseCitation[]
    metadata?: ResponseTurnMetadata | null
  }
) {
  const service = await getChatService()
  return service.saveChatMessage(chatId, role, text, options)
}

export async function updateChatSessionOpenAIState(
  chatId: string,
  openaiState: NonNullable<ChatSession['openaiState']>
) {
  const service = await getChatService()
  return service.updateChatSessionOpenAIState(chatId, openaiState)
}

