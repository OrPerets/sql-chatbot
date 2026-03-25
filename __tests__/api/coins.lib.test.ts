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
    COINS_LEDGER: 'coins_ledger',
  },
}))

import {
  CoinsService,
  DEFAULT_HOMEWORK_HINT_COST,
  DEFAULT_MESSAGE_COST,
  DEFAULT_MODULES,
  DEFAULT_SQL_PRACTICE_COST,
  DEFAULT_STARTER_BALANCE,
  DEFAULT_STATUS,
} from '@/lib/coins'

describe('CoinsService', () => {
  const email = 'student@example.com'
  let mockCoinsCollection: any
  let mockStatusCollection: any
  let mockLedgerCollection: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockCoinsCollection = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateMany: jest.fn(),
      updateOne: jest.fn(),
      find: jest.fn(),
    }

    mockLedgerCollection = {
      insertOne: jest.fn(),
      find: jest.fn(),
    }

    mockStatusCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    }

    mockDb.collection.mockImplementation((name: string) => {
      if (name === 'coins') return mockCoinsCollection
      if (name === 'coins_status') return mockStatusCollection
      if (name === 'coins_ledger') return mockLedgerCollection
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
    expect(config.costs).toEqual({
      mainChatMessage: DEFAULT_MESSAGE_COST,
      sqlPracticeOpen: DEFAULT_SQL_PRACTICE_COST,
      homeworkHintOpen: DEFAULT_HOMEWORK_HINT_COST,
    })
    expect(config.modules).toEqual(DEFAULT_MODULES)
    expect(config.sid).toBe('admin')
  })

  it('normalizes legacy messageCost into new costs shape', async () => {
    mockStatusCollection.findOne.mockResolvedValue({
      sid: 'admin',
      status: 'ON',
      messageCost: 3,
      starterBalance: 12,
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    })
    const service = new CoinsService({} as any)

    const config = await service.getCoinsConfig()

    expect(config.status).toBe('ON')
    expect(config.messageCost).toBe(3)
    expect(config.costs.mainChatMessage).toBe(3)
    expect(config.modules).toEqual({
      ...DEFAULT_MODULES,
      mainChat: true,
    })
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
    mockLedgerCollection.insertOne.mockResolvedValue({ acknowledged: true, insertedId: 'txn1' })
    const service = new CoinsService({} as any)

    const result = await service.chargeMichaelMessage(email)

    expect(result).toEqual({ ok: true })
    expect(mockCoinsCollection.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { user: email, coins: { $gte: 1 } },
      { $inc: { coins: -1 } },
      { returnDocument: 'after' }
    )
    expect(mockLedgerCollection.insertOne).toHaveBeenCalledTimes(1)
    expect(mockLedgerCollection.insertOne.mock.calls[0][0]).toMatchObject({
      user: email,
      delta: -1,
      reason: 'main_chat_message',
      source: 'main_chat',
    })
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
    expect(mockLedgerCollection.insertOne).not.toHaveBeenCalled()
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
    expect(mockLedgerCollection.insertOne).not.toHaveBeenCalled()
  })

  it('chargeSqlPracticeOpen decrements balance and logs a practice transaction', async () => {
    mockStatusCollection.findOne.mockResolvedValue({
      sid: 'admin',
      status: 'OFF',
      messageCost: 1,
      starterBalance: 20,
      modules: { ...DEFAULT_MODULES, sqlPractice: true },
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
      updatedAt: new Date(),
    })
    mockCoinsCollection.findOneAndUpdate
      .mockResolvedValueOnce({ user: email, coins: 20 })
      .mockResolvedValueOnce({ user: email, coins: 19 })
    mockLedgerCollection.insertOne.mockResolvedValue({ acknowledged: true, insertedId: 'txn-practice' })
    const service = new CoinsService({} as any)

    const result = await service.chargeSqlPracticeOpen(email, { entryPoint: 'chat' })

    expect(result).toEqual({ ok: true })
    expect(mockLedgerCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        user: email,
        delta: -1,
        reason: 'sql_practice_open',
        source: 'sql_practice',
        metadata: { entryPoint: 'chat' },
      })
    )
  })

  it('chargeSqlPracticeOpen bypasses charging when SQL practice is disabled', async () => {
    mockStatusCollection.findOne.mockResolvedValue({
      sid: 'admin',
      status: 'OFF',
      messageCost: 1,
      starterBalance: 20,
      modules: { ...DEFAULT_MODULES, sqlPractice: false },
      costs: { mainChatMessage: 1, sqlPracticeOpen: 1, homeworkHintOpen: 1 },
      updatedAt: new Date(),
    })
    const service = new CoinsService({} as any)

    const result = await service.chargeSqlPracticeOpen(email)

    expect(result).toEqual({ ok: true })
    expect(mockCoinsCollection.findOneAndUpdate).not.toHaveBeenCalled()
    expect(mockLedgerCollection.insertOne).not.toHaveBeenCalled()
  })

  it('setCoinsConfig merges modules and costs while keeping compatibility fields', async () => {
    mockStatusCollection.findOne.mockResolvedValue({
      sid: 'admin',
      status: 'OFF',
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(),
    })
    mockStatusCollection.updateOne.mockResolvedValue({ acknowledged: true })
    const service = new CoinsService({} as any)

    const result = await service.setCoinsConfig(
      {
        modules: { mainChat: true, sqlPractice: true },
        costs: { sqlPracticeOpen: 4, mainChatMessage: 2 },
      },
      'admin@example.com'
    )

    expect(result.status).toBe('ON')
    expect(result.messageCost).toBe(2)
    expect(result.modules).toEqual({
      mainChat: true,
      homeworkHints: false,
      sqlPractice: true,
    })
    expect(result.costs).toEqual({
      mainChatMessage: 2,
      sqlPracticeOpen: 4,
      homeworkHintOpen: 1,
    })
    expect(mockStatusCollection.updateOne).toHaveBeenCalledTimes(1)
  })

  it('adjustBalanceAdmin does not reduce a balance below zero and logs the actual delta', async () => {
    mockStatusCollection.findOne.mockResolvedValue({
      sid: 'admin',
      status: 'OFF',
      messageCost: 1,
      starterBalance: 20,
      updatedAt: new Date(),
    })
    mockCoinsCollection.findOneAndUpdate.mockResolvedValue({ user: email, coins: 2 })
    mockCoinsCollection.findOne.mockResolvedValue({ user: email, coins: 2 })
    mockCoinsCollection.updateOne.mockResolvedValue({ acknowledged: true, modifiedCount: 1 })
    mockLedgerCollection.insertOne.mockResolvedValue({ acknowledged: true, insertedId: 'txn-reduce' })
    const service = new CoinsService({} as any)

    const result = await service.adjustBalanceAdmin([email], -5, 'admin@example.com')

    expect(result).toEqual({ matchedCount: 1, modifiedCount: 1 })
    expect(mockCoinsCollection.updateOne).toHaveBeenCalledWith(
      { user: email },
      { $inc: { coins: -2 } }
    )
    expect(mockLedgerCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        user: email,
        delta: -2,
        reason: 'admin_adjustment_reduce',
        createdBy: 'admin@example.com',
      })
    )
  })
})
