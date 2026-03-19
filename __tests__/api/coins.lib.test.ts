/**
 * @jest-environment node
 */

const mockExecuteWithRetry = jest.fn()
const mockConnectToDatabase = jest.fn()
const mockDb = {
  collection: jest.fn(),
}

jest.mock('@/lib/database', () => ({
  connectToDatabase: (...args: any[]) => mockConnectToDatabase(...args),
  executeWithRetry: (...args: any[]) => mockExecuteWithRetry(...args),
  COLLECTIONS: {
    COINS: 'coins',
    COINS_STATUS: 'coins_status',
  },
}))

import {
  CoinsService,
  DEFAULT_MESSAGE_COST,
  DEFAULT_STARTER_BALANCE,
  DEFAULT_STATUS,
} from '@/lib/coins'

describe('CoinsService', () => {
  const email = 'student@example.com'
  let mockCoinsCollection: any
  let mockStatusCollection: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockCoinsCollection = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      find: jest.fn(),
    }

    mockStatusCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    }

    mockDb.collection.mockImplementation((name: string) => {
      if (name === 'coins') return mockCoinsCollection
      if (name === 'coins_status') return mockStatusCollection
      throw new Error(`Unexpected collection: ${name}`)
    })

    mockExecuteWithRetry.mockImplementation(async (operation: (db: any) => Promise<any>) => {
      return operation(mockDb)
    })
  })

  it('returns default config when CoinsStatus doc is missing', async () => {
    mockStatusCollection.findOne.mockResolvedValue(null)
    const service = new CoinsService({} as any)

    const config = await service.getCoinsConfig()

    expect(config.status).toBe(DEFAULT_STATUS)
    expect(config.messageCost).toBe(DEFAULT_MESSAGE_COST)
    expect(config.starterBalance).toBe(DEFAULT_STARTER_BALANCE)
    expect(config.sid).toBe('admin')
  })

  it('getOrCreateUserBalance seeds starter balance for new user', async () => {
    mockStatusCollection.findOne.mockResolvedValue(null)
    mockCoinsCollection.findOneAndUpdate.mockResolvedValue({ user: email, coins: DEFAULT_STARTER_BALANCE })
    const service = new CoinsService({} as any)

    const balance = await service.getOrCreateUserBalance(email)

    expect(balance).toEqual({ user: email, coins: DEFAULT_STARTER_BALANCE })
    expect(mockCoinsCollection.findOneAndUpdate).toHaveBeenCalledWith(
      { user: email },
      { $setOnInsert: { user: email, coins: DEFAULT_STARTER_BALANCE } },
      { upsert: true, returnDocument: 'after' }
    )
  })

  it('chargeMichaelMessage decrements balance when sufficient', async () => {
    mockStatusCollection.findOne.mockResolvedValue({
      sid: 'admin',
      status: 'ON',
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(),
    })
    mockCoinsCollection.findOneAndUpdate
      .mockResolvedValueOnce({ user: email, coins: 20 }) // seed/read
      .mockResolvedValueOnce({ user: email, coins: 19 }) // charge
    const service = new CoinsService({} as any)

    const result = await service.chargeMichaelMessage(email)

    expect(result).toEqual({ ok: true })
    expect(mockCoinsCollection.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { user: email, coins: { $gte: 1 } },
      { $inc: { coins: -1 } },
      { returnDocument: 'after' }
    )
  })

  it('chargeMichaelMessage returns insufficient balance payload when balance is too low', async () => {
    mockStatusCollection.findOne.mockResolvedValue({
      sid: 'admin',
      status: 'ON',
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(),
    })
    mockCoinsCollection.findOneAndUpdate
      .mockResolvedValueOnce({ user: email, coins: 0 }) // getOrCreate path (existing row)
      .mockResolvedValueOnce(null) // charge fails
    mockCoinsCollection.findOne.mockResolvedValue({ user: email, coins: 0 })
    const service = new CoinsService({} as any)

    const result = await service.chargeMichaelMessage(email)

    expect(result).toEqual({ ok: false, balance: 0, required: 1 })
    expect(mockCoinsCollection.findOne).toHaveBeenCalledWith({ user: email })
  })

  it('chargeMichaelMessage bypasses charging when feature is OFF', async () => {
    mockStatusCollection.findOne.mockResolvedValue({
      sid: 'admin',
      status: 'OFF',
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(),
    })
    const service = new CoinsService({} as any)

    const result = await service.chargeMichaelMessage(email)

    expect(result).toEqual({ ok: true })
    expect(mockCoinsCollection.findOneAndUpdate).not.toHaveBeenCalled()
    expect(mockCoinsCollection.findOne).not.toHaveBeenCalled()
  })
})
