import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface WeeklyContentDoc {
  week: number
  content: string
  dateRange?: string
  updatedBy?: string
}

export class ContentService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  async getWeeklyContent(): Promise<WeeklyContentDoc[]> {
    return executeWithRetry(async (db) => {
      return db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).find({}).sort({ week: 1 }).toArray()
    })
  }

  async setWeeklyContent(weekData: WeeklyContentDoc) {
    return executeWithRetry(async (db) => {
      return db
        .collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT)
        .replaceOne({ week: weekData.week }, weekData, { upsert: true })
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
      const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
      const current = await db.collection<WeeklyContentDoc>(COLLECTIONS.WEEKLY_CONTENT).findOne({ week })
      return current || { week, content: '', dateRange: '' }
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

export async function setSemesterStartDate(startDate: string) {
  const service = await getContentService()
  return service.setSemesterStartDate(startDate)
}

export async function getSemesterStartDate() {
  const service = await getContentService()
  return service.getSemesterStartDate()
}


