import { Db, ObjectId } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface ChatSession {
  _id?: ObjectId
  userId: string
  title: string
  createdAt: Date
  lastMessageTimestamp: Date
}

export interface ChatMessage {
  _id?: ObjectId
  chatId: ObjectId
  role: 'user' | 'assistant' | string
  text: string
  timestamp: Date
}

export class ChatService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  async getChatSessions(userId: string): Promise<ChatSession[]> {
    return executeWithRetry(async (db) => {
      return db.collection<ChatSession>(COLLECTIONS.CHAT_SESSIONS).find({ userId }).toArray()
    })
  }

  async createChatSession(userId: string, title: string): Promise<ChatSession> {
    const session: ChatSession = {
      userId,
      title,
      createdAt: new Date(),
      lastMessageTimestamp: new Date(),
    }
    return executeWithRetry(async (db) => {
      const res = await db.collection<ChatSession>(COLLECTIONS.CHAT_SESSIONS).insertOne(session)
      return { _id: res.insertedId, ...session }
    })
  }

  async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    return executeWithRetry(async (db) => {
      const objectId = new ObjectId(chatId)
      return db.collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES).find({ chatId: objectId }).toArray()
    })
  }

  async saveChatMessage(chatId: string, role: string, text: string): Promise<ChatMessage> {
    const message: ChatMessage = {
      chatId: new ObjectId(chatId),
      role: role as any,
      text,
      timestamp: new Date(),
    }
    return executeWithRetry(async (db) => {
      await db.collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES).insertOne(message)
      await db
        .collection<ChatSession>(COLLECTIONS.CHAT_SESSIONS)
        .updateOne({ _id: new ObjectId(chatId) }, { $set: { lastMessageTimestamp: new Date() } })
      return message
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

export async function createChatSession(userId: string, title: string) {
  const service = await getChatService()
  return service.createChatSession(userId, title)
}

export async function getChatMessages(chatId: string) {
  const service = await getChatService()
  return service.getChatMessages(chatId)
}

export async function saveChatMessage(chatId: string, role: string, text: string) {
  const service = await getChatService()
  return service.saveChatMessage(chatId, role, text)
}


