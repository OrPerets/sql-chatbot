import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'
import crypto from 'crypto'

export interface UserModel {
  _id?: any
  id?: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  studentIdNumber?: string // Israeli ID number (ת.ז)
  password?: string
  role?: string
  [key: string]: any
}

export interface PasswordResetToken {
  _id?: any
  email: string
  token: string
  expiresAt: Date
  used: boolean
  createdAt: Date
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

  async createUser(userData: { email: string; firstName: string; lastName: string; password?: string; isFirst?: boolean }): Promise<{ success: boolean; insertedId?: any; error?: string }> {
    return executeWithRetry(async (db) => {
      // Check if user already exists
      const existingUser = await db.collection<UserModel>(COLLECTIONS.USERS).findOne({ email: userData.email })
      if (existingUser) {
        return { success: false, error: 'User with this email already exists' }
      }

      // Create user document
      const newUser = {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: userData.password || 'shenkar',
        isFirst: userData.isFirst !== undefined ? userData.isFirst : true,
        name: `${userData.firstName} ${userData.lastName}` // Combine for compatibility
      }

      const result = await db.collection<UserModel>(COLLECTIONS.USERS).insertOne(newUser as any)
      return { success: true, insertedId: result.insertedId }
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

  async updateUser(email: string, userData: { firstName?: string; lastName?: string; email?: string }): Promise<{ success: boolean; modifiedCount: number; error?: string }> {
    return executeWithRetry(async (db) => {
      // Check if user exists
      const existingUser = await db.collection<UserModel>(COLLECTIONS.USERS).findOne({ email })
      if (!existingUser) {
        return { success: false, modifiedCount: 0, error: 'User not found' }
      }

      // If email is being changed, check if new email already exists
      if (userData.email && userData.email !== email) {
        const emailExists = await db.collection<UserModel>(COLLECTIONS.USERS).findOne({ email: userData.email })
        if (emailExists) {
          return { success: false, modifiedCount: 0, error: 'Email already exists' }
        }
      }

      // Build update object
      const updateData: any = {}
      if (userData.firstName !== undefined) {
        updateData.firstName = userData.firstName
      }
      if (userData.lastName !== undefined) {
        updateData.lastName = userData.lastName
      }
      if (userData.email !== undefined && userData.email !== email) {
        updateData.email = userData.email
      }

      // Update name field if firstName or lastName changed
      if (userData.firstName !== undefined || userData.lastName !== undefined) {
        const firstName = userData.firstName !== undefined ? userData.firstName : existingUser.firstName
        const lastName = userData.lastName !== undefined ? userData.lastName : existingUser.lastName
        updateData.name = `${firstName} ${lastName}`
      }

      const result = await db
        .collection<UserModel>(COLLECTIONS.USERS)
        .updateOne({ email }, { $set: updateData })
      
      return { success: true, modifiedCount: result.modifiedCount ?? 0 }
    })
  }

  async getUserByEmail(email: string): Promise<UserModel | null> {
    return executeWithRetry(async (db) => {
      const user = await db.collection<UserModel>(COLLECTIONS.USERS).findOne({ email })
      return user || null
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

  async createPasswordResetToken(email: string): Promise<string> {
    return executeWithRetry(async (db) => {
      // Check if user exists
      const user = await db.collection<UserModel>(COLLECTIONS.USERS).findOne({ email })
      if (!user) {
        throw new Error('User not found')
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Store token
      await db.collection<PasswordResetToken>(COLLECTIONS.PASSWORD_RESET_TOKENS).insertOne({
        email,
        token,
        expiresAt,
        used: false,
        createdAt: new Date()
      })

      return token
    })
  }

  async validatePasswordResetToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
    return executeWithRetry(async (db) => {
      const tokenDoc = await db.collection<PasswordResetToken>(COLLECTIONS.PASSWORD_RESET_TOKENS).findOne({ token })
      
      if (!tokenDoc) {
        return { valid: false, error: 'Invalid token' }
      }

      if (tokenDoc.used) {
        return { valid: false, error: 'Token already used' }
      }

      if (new Date() > tokenDoc.expiresAt) {
        return { valid: false, error: 'Token expired' }
      }

      return { valid: true, email: tokenDoc.email }
    })
  }

  async applyPasswordResetToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    return executeWithRetry(async (db) => {
      const tokenDoc = await db.collection<PasswordResetToken>(COLLECTIONS.PASSWORD_RESET_TOKENS).findOne({ token })
      
      if (!tokenDoc || tokenDoc.used || new Date() > tokenDoc.expiresAt) {
        return { success: false, error: 'Invalid or expired token' }
      }

      // Update password
      const passwordResult = await this.updatePassword(tokenDoc.email, newPassword)
      
      if (passwordResult.modifiedCount === 0) {
        return { success: false, error: 'Failed to update password' }
      }

      // Mark token as used
      await db.collection<PasswordResetToken>(COLLECTIONS.PASSWORD_RESET_TOKENS).updateOne(
        { token },
        { $set: { used: true } }
      )

      return { success: true }
    })
  }

  async checkPasswordResetRateLimit(email: string): Promise<{ allowed: boolean; remainingTime?: number }> {
    return executeWithRetry(async (db) => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      const recentTokens = await db.collection<PasswordResetToken>(COLLECTIONS.PASSWORD_RESET_TOKENS)
        .countDocuments({ 
          email, 
          createdAt: { $gte: oneHourAgo } 
        })

      if (recentTokens >= 3) {
        const oldestToken = await db.collection<PasswordResetToken>(COLLECTIONS.PASSWORD_RESET_TOKENS)
          .findOne({ email, createdAt: { $gte: oneHourAgo } }, { sort: { createdAt: 1 } })
        
        const remainingTime = oldestToken ? 
          Math.ceil((oldestToken.createdAt.getTime() + 60 * 60 * 1000 - Date.now()) / 1000 / 60) : 0
        
        return { allowed: false, remainingTime }
      }

      return { allowed: true }
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

export async function createPasswordResetToken(email: string) {
  const service = await getUsersService()
  return service.createPasswordResetToken(email)
}

export async function validatePasswordResetToken(token: string) {
  const service = await getUsersService()
  return service.validatePasswordResetToken(token)
}

export async function applyPasswordResetToken(token: string, newPassword: string) {
  const service = await getUsersService()
  return service.applyPasswordResetToken(token, newPassword)
}

export async function checkPasswordResetRateLimit(email: string) {
  const service = await getUsersService()
  return service.checkPasswordResetRateLimit(email)
}

export async function createUser(userData: { email: string; firstName: string; lastName: string; password?: string; isFirst?: boolean }) {
  const service = await getUsersService()
  return service.createUser(userData)
}

export async function updateUser(email: string, userData: { firstName?: string; lastName?: string; email?: string }) {
  const service = await getUsersService()
  return service.updateUser(email, userData)
}

export async function getUserByEmail(email: string) {
  const service = await getUsersService()
  return service.getUserByEmail(email)
}


