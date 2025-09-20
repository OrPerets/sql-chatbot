import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface UserModel {
  _id?: any
  id?: string
  email: string
  name?: string
  password?: string
  role?: string
  [key: string]: any
}

export class UsersService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  async getAllUsers(): Promise<UserModel[]> {
    return executeWithRetry(async (db) => {
      const users = await db.collection<UserModel>(COLLECTIONS.USERS).find({}).toArray()
      return users
    })
  }

  async updatePassword(emails: string | string[], newPassword: string): Promise<{ modifiedCount: number }> {
    const emailList = Array.isArray(emails) ? emails : [emails]
    return executeWithRetry(async (db) => {
      const result = await db
        .collection<UserModel>(COLLECTIONS.USERS)
        .updateMany({ email: { $in: emailList } }, { $set: { password: newPassword } })
      return { modifiedCount: result.modifiedCount ?? 0 }
    })
  }

  async getCoinsBalance(email: string): Promise<any[]> {
    return executeWithRetry(async (db) => {
      const docs = await db.collection(COLLECTIONS.COINS).find({ user: email }).toArray()
      return docs
    })
  }

  async setCoinsBalance(email: string, currentBalance: number): Promise<{ upsertedId?: any; modifiedCount?: number }>{
    return executeWithRetry(async (db) => {
      const result = await db
        .collection(COLLECTIONS.COINS)
        .updateOne({ user: email }, { $set: { coins: currentBalance } }, { upsert: true })
      return { upsertedId: (result as any).upsertedId, modifiedCount: (result as any).modifiedCount }
    })
  }
}

let usersService: UsersService | null = null

export async function getUsersService(): Promise<UsersService> {
  if (!usersService) {
    const { db } = await connectToDatabase()
    usersService = new UsersService(db)
  }
  return usersService
}

export async function getAllUsers() {
  const service = await getUsersService()
  return service.getAllUsers()
}

export async function updatePassword(emails: string | string[], newPassword: string) {
  const service = await getUsersService()
  return service.updatePassword(emails, newPassword)
}

export async function getCoinsBalance(email: string) {
  const service = await getUsersService()
  return service.getCoinsBalance(email)
}

export async function setCoinsBalance(email: string, currentBalance: number) {
  const service = await getUsersService()
  return service.setCoinsBalance(email, currentBalance)
}


