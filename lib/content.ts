import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface WeeklyContentDoc {
  week: number
  content: string
  dateRange?: string
  updatedBy?: string
  updatedAt?: string
}

export interface WeekContextNormalized {
  weekNumber: number | null
  content: string | null
  dateRange: string | null
  updatedAt?: string | null
  updatedBy?: string | null
}

export class ContentService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  private clampWeek(week: number): number {
    if (week < 1) return 1
    if (week > 14) return 14
    return week
  }

  async getWeeklyContent(): Promise<WeeklyContentDoc[]> {
    return executeWithRetry(async (db) => {
      return db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).find({}).sort({ week: 1 }).toArray()
    })
  }

  async setWeeklyContent(weekData: WeeklyContentDoc) {
    return executeWithRetry(async (db) => {
      const doc: WeeklyContentDoc = {
        ...weekData,
        updatedAt: new Date().toISOString(),
      }
      return db
        .collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT)
        .replaceOne({ week: weekData.week }, doc, { upsert: true })
    })
  }

  async getCurrentWeekContent(semesterStartDate: string | null = null) {
    return executeWithRetry(async (db) => {
      let startDateStr = semesterStartDate
      if (!startDateStr) {
        const config = await db.collection(COLLECTIONS.SEMESTER_CONFIG).findOne({ type: 'semester_start' })
        startDateStr = config?.startDate || null
      }

      if (!startDateStr) {
        return { week: 0, content: '', dateRange: '' }
      }

      const now = new Date()
      const startDate = new Date(startDateStr)
      const diffMs = now.getTime() - startDate.getTime()
      // Calculate week: Week 1 = days 0-6, Week 2 = days 7-13, etc.
      // Formula: Math.floor(days / 7) + 1 ensures day 0-6 = week 1, day 7-13 = week 2
      const rawWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
      const week = this.clampWeek(rawWeek)
      const current = await db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).findOne({ week })
      if (current) {
        return { week, content: current.content || '', dateRange: current.dateRange || '' }
      }
      return { week, content: '', dateRange: '' }
    })
  }

  async getWeekContextNormalized(week: number): Promise<WeekContextNormalized> {
    return executeWithRetry(async (db) => {
      const clamped = this.clampWeek(week)
      const doc = await db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).findOne({ week: clamped })
      return {
        weekNumber: clamped,
        content: doc?.content ?? null,
        dateRange: doc?.dateRange ?? null,
        updatedAt: doc?.updatedAt ?? null,
        updatedBy: doc?.updatedBy ?? null,
      }
    })
  }

  async getCurrentWeekContextNormalized(semesterStartDate: string | null = null): Promise<WeekContextNormalized> {
    return executeWithRetry(async (db) => {
      let startDateStr = semesterStartDate
      if (!startDateStr) {
        const config = await db.collection(COLLECTIONS.SEMESTER_CONFIG).findOne({ type: 'semester_start' })
        startDateStr = config?.startDate || null
      }

      if (!startDateStr) {
        return { weekNumber: null, content: null, dateRange: null }
      }

      const now = new Date()
      const startDate = new Date(startDateStr)
      const diffMs = now.getTime() - startDate.getTime()
      // Calculate week: Week 1 = days 0-6, Week 2 = days 7-13, etc.
      // Formula: Math.floor(days / 7) + 1 ensures day 0-6 = week 1, day 7-13 = week 2
      const rawWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
      const week = this.clampWeek(rawWeek)

      const doc = await db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).findOne({ week })
      return {
        weekNumber: week,
        content: doc?.content ?? null,
        dateRange: doc?.dateRange ?? null,
        updatedAt: doc?.updatedAt ?? null,
        updatedBy: doc?.updatedBy ?? null,
      }
    })
  }

  async setSemesterStartDate(startDate: string) {
    return executeWithRetry(async (db) => {
      return db
        .collection(COLLECTIONS.SEMESTER_CONFIG)
        .replaceOne({ type: 'semester_start' }, { type: 'semester_start', startDate }, { upsert: true })
    })
  }

  async getSemesterStartDate(): Promise<string | null> {
    return executeWithRetry(async (db) => {
      const config = await db.collection(COLLECTIONS.SEMESTER_CONFIG).findOne({ type: 'semester_start' })
      return (config?.startDate as string) || null
    })
  }
}

let contentService: ContentService | null = null

export async function getContentService(): Promise<ContentService> {
  if (!contentService) {
    const { db } = await connectToDatabase()
    contentService = new ContentService(db)
  }
  return contentService
}

export async function getWeeklyContent() {
  const service = await getContentService()
  return service.getWeeklyContent()
}

export async function setWeeklyContent(weekData: WeeklyContentDoc) {
  const service = await getContentService()
  return service.setWeeklyContent(weekData)
}

export async function getCurrentWeekContent(semesterStartDate?: string | null) {
  const service = await getContentService()
  return service.getCurrentWeekContent(semesterStartDate ?? null)
}

export async function getWeekContextByNumberNormalized(week: number): Promise<WeekContextNormalized> {
  const service = await getContentService()
  return service.getWeekContextNormalized(week)
}

export async function getCurrentWeekContextNormalized(semesterStartDate?: string | null): Promise<WeekContextNormalized> {
  const service = await getContentService()
  return service.getCurrentWeekContextNormalized(semesterStartDate ?? null)
}

export async function setSemesterStartDate(startDate: string) {
  const service = await getContentService()
  return service.setSemesterStartDate(startDate)
}

export async function getSemesterStartDate() {
  const service = await getContentService()
  return service.getSemesterStartDate()
}


