import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface CoinDoc {
  _id?: any
  user: string
  coins: number
}

export type CoinsFeatureStatus = 'ON' | 'OFF'

export type CoinChargeReason =
  | 'main_chat_message'
  | 'sql_practice_open'
  | 'homework_hint_open'
  | 'admin_adjustment_add'
  | 'admin_adjustment_reduce'

export type CoinChargeSource = 'main_chat' | 'sql_practice' | 'homework' | 'admin'

export interface CoinTransaction {
  _id?: any
  user: string
  delta: number
  reason: CoinChargeReason
  source: CoinChargeSource
  metadata?: Record<string, unknown>
  createdAt: Date
  createdBy?: string
}

export interface CoinsModulesConfig {
  mainChat: boolean
  homeworkHints: boolean
  sqlPractice: boolean
}

export interface CoinsCostsConfig {
  mainChatMessage: number
  sqlPracticeOpen: number
  homeworkHintOpen: number
}

export interface CoinsConfigDoc {
  sid: 'admin'
  status: CoinsFeatureStatus
  messageCost: number
  starterBalance: number
  costs: CoinsCostsConfig
  modules: CoinsModulesConfig
  updatedAt: Date
  updatedBy?: string
}

export interface CoinsConfigPatch {
  status?: CoinsConfigDoc['status']
  messageCost?: CoinsConfigDoc['messageCost']
  starterBalance?: CoinsConfigDoc['starterBalance']
  costs?: Partial<CoinsCostsConfig>
  modules?: Partial<CoinsModulesConfig>
}

interface CoinsStatusCollectionDoc {
  _id?: any
  sid?: string
  status?: unknown
  messageCost?: unknown
  starterBalance?: unknown
  costs?: unknown
  modules?: unknown
  updatedAt?: unknown
  updatedBy?: unknown
}

export const DEFAULT_MESSAGE_COST = 1
export const DEFAULT_STARTER_BALANCE = 20
export const DEFAULT_STATUS: CoinsFeatureStatus = 'OFF'
export const DEFAULT_SQL_PRACTICE_COST = 1
export const DEFAULT_HOMEWORK_HINT_COST = 1
export const DEFAULT_MODULES: CoinsModulesConfig = {
  mainChat: false,
  homeworkHints: false,
  sqlPractice: false,
}
const COINS_CONFIG_SID = 'admin' as const

const CHARGE_REASON_TO_SOURCE: Record<CoinChargeReason, CoinChargeSource> = {
  main_chat_message: 'main_chat',
  sql_practice_open: 'sql_practice',
  homework_hint_open: 'homework',
  admin_adjustment_add: 'admin',
  admin_adjustment_reduce: 'admin',
}

function normalizeNumber(value: unknown, fallback: number, { minimum = 0 } = {}): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= minimum) {
    return value
  }
  return fallback
}

function normalizeModules(value: unknown): CoinsModulesConfig {
  const modules = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    mainChat: modules.mainChat === true,
    homeworkHints: modules.homeworkHints === true,
    sqlPractice: modules.sqlPractice === true,
  }
}

function normalizeCosts(value: unknown, messageCost: unknown): CoinsCostsConfig {
  const costs = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const normalizedMainChatCost = normalizeNumber(
    costs.mainChatMessage,
    normalizeNumber(messageCost, DEFAULT_MESSAGE_COST)
  )

  return {
    mainChatMessage: normalizedMainChatCost,
    sqlPracticeOpen: normalizeNumber(costs.sqlPracticeOpen, DEFAULT_SQL_PRACTICE_COST),
    homeworkHintOpen: normalizeNumber(costs.homeworkHintOpen, DEFAULT_HOMEWORK_HINT_COST),
  }
}

// Missing CoinsStatus admin config is treated as OFF with default costs/balances.
function normalizeCoinsConfig(doc?: CoinsStatusCollectionDoc | null): CoinsConfigDoc {
  const hasExplicitModules = Boolean(doc?.modules && typeof doc.modules === 'object')
  const modules = normalizeModules(doc?.modules)
  if (!hasExplicitModules && doc?.status === 'ON') {
    modules.mainChat = true
  }
  const costs = normalizeCosts(doc?.costs, doc?.messageCost)
  const starterBalance = normalizeNumber(doc?.starterBalance, DEFAULT_STARTER_BALANCE)
  const updatedAt = doc?.updatedAt instanceof Date ? doc.updatedAt : new Date(0)
  const updatedBy = typeof doc?.updatedBy === 'string' ? doc.updatedBy : undefined
  const normalizedStatus: CoinsFeatureStatus = hasExplicitModules
    ? modules.mainChat
      ? 'ON'
      : 'OFF'
    : doc?.status === 'ON'
      ? 'ON'
      : DEFAULT_STATUS

  return {
    sid: COINS_CONFIG_SID,
    status: normalizedStatus,
    messageCost: costs.mainChatMessage,
    starterBalance,
    costs,
    modules,
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

function normalizeTransaction(doc: Partial<CoinTransaction> | null | undefined): CoinTransaction | null {
  if (!doc || typeof doc.user !== 'string') {
    return null
  }

  return {
    user: doc.user,
    delta: typeof doc.delta === 'number' && Number.isFinite(doc.delta) ? doc.delta : 0,
    reason:
      typeof doc.reason === 'string' && doc.reason in CHARGE_REASON_TO_SOURCE
        ? (doc.reason as CoinChargeReason)
        : 'admin_adjustment_add',
    source:
      typeof doc.source === 'string' &&
      ['main_chat', 'sql_practice', 'homework', 'admin'].includes(doc.source)
        ? (doc.source as CoinChargeSource)
        : 'admin',
    metadata:
      doc.metadata && typeof doc.metadata === 'object'
        ? (doc.metadata as Record<string, unknown>)
        : undefined,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(0),
    createdBy: typeof doc.createdBy === 'string' ? doc.createdBy : undefined,
  }
}

type ChargeResult = { ok: true } | { ok: false; balance: number; required: number }

export interface CoinsAdminOverview {
  config: CoinsConfigDoc
  users: Array<
    CoinDoc & {
      totalSpent: number
      usageCount: number
      usageByReason: Partial<Record<CoinChargeReason, number>>
      lastActivity: string | null
    }
  >
  summary: {
    totalUsers: number
    totalBalance: number
    totalTransactions: number
    totalSpent: number
    usageByReason: Partial<Record<CoinChargeReason, number>>
    usageBySource: Partial<Record<CoinChargeSource, number>>
    lastActivity: string | null
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

  async getCoinTransactions(): Promise<CoinTransaction[]> {
    return executeWithRetry(async (db) => {
      const docs = await db.collection<CoinTransaction>(COLLECTIONS.COINS_LEDGER).find({}).toArray()
      return docs
        .map((doc) => normalizeTransaction(doc))
        .filter((doc): doc is CoinTransaction => Boolean(doc))
    })
  }

  async getCoinsStatus(): Promise<any[]> {
    const config = await this.getCoinsConfig()
    return [config]
  }

  async setCoinsStatus(val: any) {
    const status = val === 'ON' ? 'ON' : 'OFF'
    return this.setCoinsConfig({ status, modules: { mainChat: status === 'ON' } })
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
    const current = await this.getCoinsConfig()
    const mergedModules: CoinsModulesConfig = {
      ...current.modules,
      ...(partial.modules || {}),
    }
    const mergedCosts: CoinsCostsConfig = {
      ...current.costs,
      ...(partial.costs || {}),
    }

    if (partial.messageCost !== undefined) {
      mergedCosts.mainChatMessage = normalizeNumber(partial.messageCost, DEFAULT_MESSAGE_COST)
    }

    const resolvedStatus: CoinsFeatureStatus =
      partial.status !== undefined ? (partial.status === 'ON' ? 'ON' : 'OFF') : mergedModules.mainChat ? 'ON' : 'OFF'

    if (partial.status !== undefined && partial.modules?.mainChat === undefined) {
      mergedModules.mainChat = resolvedStatus === 'ON'
    }

    const nextConfig: CoinsConfigDoc = {
      sid: COINS_CONFIG_SID,
      status: mergedModules.mainChat ? 'ON' : 'OFF',
      messageCost: normalizeNumber(mergedCosts.mainChatMessage, DEFAULT_MESSAGE_COST),
      starterBalance: normalizeNumber(
        partial.starterBalance ?? current.starterBalance,
        DEFAULT_STARTER_BALANCE
      ),
      costs: {
        mainChatMessage: normalizeNumber(mergedCosts.mainChatMessage, DEFAULT_MESSAGE_COST),
        sqlPracticeOpen: normalizeNumber(mergedCosts.sqlPracticeOpen, DEFAULT_SQL_PRACTICE_COST),
        homeworkHintOpen: normalizeNumber(
          mergedCosts.homeworkHintOpen,
          DEFAULT_HOMEWORK_HINT_COST
        ),
      },
      modules: mergedModules,
      updatedAt: new Date(),
      updatedBy: updatedBy || current.updatedBy,
    }

    await executeWithRetry(async (db) => {
      return db.collection(COLLECTIONS.COINS_STATUS).updateOne(
        { sid: COINS_CONFIG_SID },
        {
          $set: nextConfig,
          $setOnInsert: { sid: COINS_CONFIG_SID },
        },
        { upsert: true }
      )
    })

    return nextConfig
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

  async logCoinTransaction(entry: {
    user: string
    delta: number
    reason: CoinChargeReason
    metadata?: Record<string, unknown>
    createdBy?: string
  }) {
    const transaction: CoinTransaction = {
      user: entry.user,
      delta: entry.delta,
      reason: entry.reason,
      source: CHARGE_REASON_TO_SOURCE[entry.reason],
      metadata: entry.metadata,
      createdAt: new Date(),
      createdBy: entry.createdBy,
    }

    return executeWithRetry(async (db) => {
      return db.collection<CoinTransaction>(COLLECTIONS.COINS_LEDGER).insertOne(transaction)
    })
  }

  private async chargeAction(
    email: string,
    moduleKey: keyof CoinsModulesConfig,
    costKey: keyof CoinsCostsConfig,
    reason: CoinChargeReason,
    metadata?: Record<string, unknown>
  ): Promise<ChargeResult> {
    const config = await this.getCoinsConfig()
    if (!config.modules[moduleKey]) {
      return { ok: true }
    }

    const required = normalizeNumber(config.costs[costKey], DEFAULT_MESSAGE_COST)

    if (required <= 0) {
      return { ok: true }
    }

    await this.getOrCreateUserBalance(email)

    const updated = await executeWithRetry(async (db) => {
      return db.collection<CoinDoc>(COLLECTIONS.COINS).findOneAndUpdate(
        { user: email, coins: { $gte: required } },
        { $inc: { coins: -required } },
        { returnDocument: 'after' }
      )
    })

    if (!updated) {
      const current = await this.getUserBalance(email)
      return { ok: false, balance: current.coins, required }
    }

    await this.logCoinTransaction({
      user: email,
      delta: -required,
      reason,
      metadata,
    })

    return { ok: true }
  }

  async chargeMainChatMessage(email: string, metadata?: Record<string, unknown>): Promise<ChargeResult> {
    return this.chargeAction(email, 'mainChat', 'mainChatMessage', 'main_chat_message', metadata)
  }

  async chargeSqlPracticeOpen(email: string, metadata?: Record<string, unknown>): Promise<ChargeResult> {
    return this.chargeAction(email, 'sqlPractice', 'sqlPracticeOpen', 'sql_practice_open', metadata)
  }

  async chargeHomeworkHintOpen(email: string, metadata?: Record<string, unknown>): Promise<ChargeResult> {
    return this.chargeAction(email, 'homeworkHints', 'homeworkHintOpen', 'homework_hint_open', metadata)
  }

  async chargeMichaelMessage(email: string): Promise<ChargeResult> {
    return this.chargeMainChatMessage(email)
  }

  async adjustBalanceAdmin(users: string[], delta: number, adminEmail?: string) {
    const uniqueUsers = [...new Set(users.filter((user): user is string => typeof user === 'string' && user.trim().length > 0))]
    if (uniqueUsers.length === 0 || !Number.isFinite(delta) || delta === 0) {
      return { matchedCount: 0, modifiedCount: 0 }
    }

    await Promise.all(uniqueUsers.map((user) => this.getOrCreateUserBalance(user)))

    if (delta > 0) {
      const result = await this.updateCoinsBalance(uniqueUsers, delta)

      await Promise.all(
        uniqueUsers.map((user) =>
          this.logCoinTransaction({
            user,
            delta,
            reason: 'admin_adjustment_add',
            createdBy: adminEmail,
          })
        )
      )

      return result
    }

    let modifiedCount = 0

    await Promise.all(
      uniqueUsers.map(async (user) => {
        const currentBalance = await this.getUserBalance(user)
        const safeDelta = Math.max(delta, -currentBalance.coins)

        if (safeDelta === 0) {
          return
        }

        await executeWithRetry(async (db) => {
          return db.collection<CoinDoc>(COLLECTIONS.COINS).updateOne(
            { user },
            { $inc: { coins: safeDelta } }
          )
        })

        modifiedCount += 1

        await this.logCoinTransaction({
          user,
          delta: safeDelta,
          reason: 'admin_adjustment_reduce',
          createdBy: adminEmail,
        })
      })
    )

    return {
      matchedCount: uniqueUsers.length,
      modifiedCount,
    }
  }

  async getAdminOverview(): Promise<CoinsAdminOverview> {
    const [config, users, transactions] = await Promise.all([
      this.getCoinsConfig(),
      this.getAllCoins(),
      this.getCoinTransactions(),
    ])

    const usageByReason: Partial<Record<CoinChargeReason, number>> = {}
    const usageBySource: Partial<Record<CoinChargeSource, number>> = {}
    const perUser = new Map<
      string,
      {
        totalSpent: number
        usageCount: number
        usageByReason: Partial<Record<CoinChargeReason, number>>
        lastActivity: Date | null
      }
    >()
    let lastActivity: Date | null = null
    let totalSpent = 0

    for (const transaction of transactions) {
      usageByReason[transaction.reason] = (usageByReason[transaction.reason] || 0) + 1
      usageBySource[transaction.source] = (usageBySource[transaction.source] || 0) + 1

      if (!lastActivity || transaction.createdAt > lastActivity) {
        lastActivity = transaction.createdAt
      }

      const current = perUser.get(transaction.user) || {
        totalSpent: 0,
        usageCount: 0,
        usageByReason: {},
        lastActivity: null,
      }

      current.usageByReason[transaction.reason] = (current.usageByReason[transaction.reason] || 0) + 1
      current.usageCount += 1
      if (transaction.delta < 0) {
        current.totalSpent += Math.abs(transaction.delta)
        totalSpent += Math.abs(transaction.delta)
      }
      if (!current.lastActivity || transaction.createdAt > current.lastActivity) {
        current.lastActivity = transaction.createdAt
      }

      perUser.set(transaction.user, current)
    }

    const enrichedUsers = users.map((user) => {
      const stats = perUser.get(user.user)
      return {
        ...user,
        totalSpent: stats?.totalSpent || 0,
        usageCount: stats?.usageCount || 0,
        usageByReason: stats?.usageByReason || {},
        lastActivity: stats?.lastActivity ? stats.lastActivity.toISOString() : null,
      }
    })

    return {
      config,
      users: enrichedUsers,
      summary: {
        totalUsers: users.length,
        totalBalance: users.reduce((sum, user) => sum + user.coins, 0),
        totalTransactions: transactions.length,
        totalSpent,
        usageByReason,
        usageBySource,
        lastActivity: lastActivity ? lastActivity.toISOString() : null,
      },
    }
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

export async function getCoinsAdminOverview() {
  const service = await getCoinsService()
  return service.getAdminOverview()
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

export async function chargeMainChatMessage(email: string, metadata?: Record<string, unknown>) {
  const service = await getCoinsService()
  return service.chargeMainChatMessage(email, metadata)
}

export async function chargeSqlPracticeOpen(email: string, metadata?: Record<string, unknown>) {
  const service = await getCoinsService()
  return service.chargeSqlPracticeOpen(email, metadata)
}

export async function chargeHomeworkHintOpen(email: string, metadata?: Record<string, unknown>) {
  const service = await getCoinsService()
  return service.chargeHomeworkHintOpen(email, metadata)
}

export async function logCoinTransaction(entry: Parameters<CoinsService['logCoinTransaction']>[0]) {
  const service = await getCoinsService()
  return service.logCoinTransaction(entry)
}

export async function adjustBalanceAdmin(users: string[], delta: number, adminEmail?: string) {
  const service = await getCoinsService()
  return service.adjustBalanceAdmin(users, delta, adminEmail)
}
