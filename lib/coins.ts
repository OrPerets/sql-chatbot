import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface CoinDoc {
  _id?: any
  user: string
  coins: number
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
    return executeWithRetry(async (db) => {
      return db.collection(COLLECTIONS.COINS_STATUS).find({}).toArray()
    })
  }

  async setCoinsStatus(val: any) {
    return executeWithRetry(async (db) => {
      return db
        .collection(COLLECTIONS.COINS_STATUS)
        .updateOne({ sid: 'admin' }, { $set: { status: val } }, { upsert: true })
    })
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


