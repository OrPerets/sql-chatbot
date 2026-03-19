import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface CoinDoc {
  _id?: any
  user: string
  coins: number
}

export type CoinsFeatureStatus = 'ON' | 'OFF'

export interface CoinsConfigDoc {
  sid: 'admin'
  status: CoinsFeatureStatus
  messageCost: number
  starterBalance: number
  updatedAt: Date
  updatedBy?: string
}

type CoinsConfigPatch = Partial<Pick<CoinsConfigDoc, 'status' | 'messageCost' | 'starterBalance'>>

interface CoinsStatusCollectionDoc {
  _id?: any
  sid?: string
  status?: unknown
  messageCost?: unknown
  starterBalance?: unknown
  updatedAt?: unknown
  updatedBy?: unknown
}

export const DEFAULT_MESSAGE_COST = 1
export const DEFAULT_STARTER_BALANCE = 20
export const DEFAULT_STATUS: CoinsFeatureStatus = 'OFF'
const COINS_CONFIG_SID = 'admin' as const

// Missing CoinsStatus admin config is treated as OFF with default costs/balances.
function normalizeCoinsConfig(doc?: CoinsStatusCollectionDoc | null): CoinsConfigDoc {
  const normalizedStatus: CoinsFeatureStatus = doc?.status === 'ON' ? 'ON' : DEFAULT_STATUS
  const messageCost =
    typeof doc?.messageCost === 'number' && Number.isFinite(doc.messageCost)
      ? doc.messageCost
      : DEFAULT_MESSAGE_COST
  const starterBalance =
    typeof doc?.starterBalance === 'number' && Number.isFinite(doc.starterBalance)
      ? doc.starterBalance
      : DEFAULT_STARTER_BALANCE
  const updatedAt = doc?.updatedAt instanceof Date ? doc.updatedAt : new Date(0)
  const updatedBy = typeof doc?.updatedBy === 'string' ? doc.updatedBy : undefined

  return {
    sid: COINS_CONFIG_SID,
    status: normalizedStatus,
    messageCost,
    starterBalance,
    updatedAt,
    updatedBy,
  }
}

function normalizeCoinDoc(doc: Partial<CoinDoc> | null | undefined, fallbackUser: string): CoinDoc {
  return {
    user: typeof doc?.user === 'string' ? doc.user : fallbackUser,
    coins: typeof doc?.coins === 'number' && Number.isFinite(doc.coins) ? doc.coins : 0,
  }
}

export class CoinsService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  async updateCoinsBalance(users: string[], amount: number) {
    return executeWithRetry(async (db) => {
      const result = await db
        .collection<CoinDoc>(COLLECTIONS.COINS)
        .updateMany({ user: { $in: users } }, { $inc: { coins: amount } })
      return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }
    })
  }

  async getAllCoins(): Promise<CoinDoc[]> {
    return executeWithRetry(async (db) => {
      return db.collection<CoinDoc>(COLLECTIONS.COINS).find({}).toArray()
    })
  }

  async getCoinsStatus(): Promise<any[]> {
    const config = await this.getCoinsConfig()
    return [config]
  }

  async setCoinsStatus(val: any) {
    return this.setCoinsConfig({ status: val === 'ON' ? 'ON' : 'OFF' })
  }

  async getCoinsConfig(): Promise<CoinsConfigDoc> {
    return executeWithRetry(async (db) => {
      const doc = await db
        .collection<CoinsStatusCollectionDoc>(COLLECTIONS.COINS_STATUS)
        .findOne({ sid: COINS_CONFIG_SID })
      return normalizeCoinsConfig(doc)
    })
  }

  async setCoinsConfig(partial: CoinsConfigPatch, updatedBy?: string) {
    const $set: Partial<CoinsConfigDoc> = {
      updatedAt: new Date(),
    }

    if (partial.status !== undefined) {
      $set.status = partial.status === 'ON' ? 'ON' : 'OFF'
    }
    if (partial.messageCost !== undefined) {
      $set.messageCost =
        typeof partial.messageCost === 'number' && Number.isFinite(partial.messageCost)
          ? partial.messageCost
          : DEFAULT_MESSAGE_COST
    }
    if (partial.starterBalance !== undefined) {
      $set.starterBalance =
        typeof partial.starterBalance === 'number' && Number.isFinite(partial.starterBalance)
          ? partial.starterBalance
          : DEFAULT_STARTER_BALANCE
    }
    if (updatedBy) {
      $set.updatedBy = updatedBy
    }

    return executeWithRetry(async (db) => {
      return db.collection(COLLECTIONS.COINS_STATUS).updateOne(
        { sid: COINS_CONFIG_SID },
        {
          $set,
          $setOnInsert: { sid: COINS_CONFIG_SID },
        },
        { upsert: true }
      )
    })
  }

  async getOrCreateUserBalance(email: string): Promise<CoinDoc> {
    const config = await this.getCoinsConfig()
    return executeWithRetry(async (db) => {
      const result = await db.collection<CoinDoc>(COLLECTIONS.COINS).findOneAndUpdate(
        { user: email },
        { $setOnInsert: { user: email, coins: config.starterBalance } },
        { upsert: true, returnDocument: 'after' }
      )
      return normalizeCoinDoc(result, email)
    })
  }

  async getUserBalance(email: string): Promise<CoinDoc> {
    return executeWithRetry(async (db) => {
      const doc = await db.collection<CoinDoc>(COLLECTIONS.COINS).findOne({ user: email })
      // Canonical no-row representation: return zero balance without inserting.
      return normalizeCoinDoc(doc, email)
    })
  }

  async chargeMichaelMessage(
    email: string
  ): Promise<{ ok: true } | { ok: false; balance: number; required: number }> {
    const config = await this.getCoinsConfig()
    if (config.status !== 'ON') {
      return { ok: true }
    }

    const messageCost =
      typeof config.messageCost === 'number' && Number.isFinite(config.messageCost)
        ? config.messageCost
        : DEFAULT_MESSAGE_COST

    if (messageCost <= 0) {
      return { ok: true }
    }

    await this.getOrCreateUserBalance(email)

    const updated = await executeWithRetry(async (db) => {
      return db.collection<CoinDoc>(COLLECTIONS.COINS).findOneAndUpdate(
        { user: email, coins: { $gte: messageCost } },
        { $inc: { coins: -messageCost } },
        { returnDocument: 'after' }
      )
    })

    if (!updated) {
      const current = await this.getUserBalance(email)
      return { ok: false, balance: current.coins, required: messageCost }
    }

    return { ok: true }
  }

  async adjustBalanceAdmin(users: string[], delta: number, adminEmail?: string) {
    void adminEmail
    return this.updateCoinsBalance(users, delta)
  }
}

let coinsService: CoinsService | null = null

export async function getCoinsService(): Promise<CoinsService> {
  if (!coinsService) {
    const { db } = await connectToDatabase()
    coinsService = new CoinsService(db)
  }
  return coinsService
}

export async function updateCoinsBalance(users: string[], amount: number) {
  const service = await getCoinsService()
  return service.updateCoinsBalance(users, amount)
}

export async function getAllCoins() {
  const service = await getCoinsService()
  return service.getAllCoins()
}

export async function getCoinsStatus() {
  const service = await getCoinsService()
  return service.getCoinsStatus()
}

export async function setCoinsStatus(val: any) {
  const service = await getCoinsService()
  return service.setCoinsStatus(val)
}

export async function getCoinsConfig() {
  const service = await getCoinsService()
  return service.getCoinsConfig()
}

export async function setCoinsConfig(partial: CoinsConfigPatch, updatedBy?: string) {
  const service = await getCoinsService()
  return service.setCoinsConfig(partial, updatedBy)
}

export async function getOrCreateUserBalance(email: string) {
  const service = await getCoinsService()
  return service.getOrCreateUserBalance(email)
}

export async function getUserBalance(email: string) {
  const service = await getCoinsService()
  return service.getUserBalance(email)
}

export async function chargeMichaelMessage(email: string) {
  const service = await getCoinsService()
  return service.chargeMichaelMessage(email)
}

export async function adjustBalanceAdmin(users: string[], delta: number, adminEmail?: string) {
  const service = await getCoinsService()
  return service.adjustBalanceAdmin(users, delta, adminEmail)
}

