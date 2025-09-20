import { Db, ObjectId } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface PracticeTableDoc {
  _id?: ObjectId
  practiceId: string
  table: string
  columns?: string[]
  constraints?: string[]
  fullSql?: string
}

export interface PracticeQueryDoc {
  _id?: ObjectId
  practiceId: string
  question: string
  answerSql: string
  [key: string]: any
}

export interface PracticeAttemptDoc {
  _id?: ObjectId
  userId: string
  queryId: ObjectId
  question: string
  userAnswer: string
  correctAnswer: string
  isCorrect: boolean
  feedbackLevel: 'correct' | 'partially_correct' | 'wrong'
  similarity: number
  timestamp: Date
}

export class PracticeService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  async getPracticeTables(): Promise<Record<string, (Omit<PracticeTableDoc, '_id'> & { id: string })[]>> {
    return executeWithRetry(async (db) => {
      const tables = await db.collection<PracticeTableDoc>(COLLECTIONS.PRACTICE_TABLES).find({}).toArray()
      const grouped: Record<string, (Omit<PracticeTableDoc, '_id'> & { id: string })[]> = {}
      for (const t of tables) {
        const id = t._id?.toString() || ''
        const item = { id, practiceId: t.practiceId, table: t.table, columns: t.columns, constraints: t.constraints, fullSql: t.fullSql }
        if (!grouped[t.practiceId]) grouped[t.practiceId] = []
        grouped[t.practiceId].push(item)
      }
      return grouped
    })
  }

  async getPracticeQueries(practiceId: string, max: number = 3): Promise<(Omit<PracticeQueryDoc, '_id'> & { _id: string })[]> {
    return executeWithRetry(async (db) => {
      const queries = await db.collection<PracticeQueryDoc>(COLLECTIONS.PRACTICE_QUERIES).find({ practiceId }).toArray()
      const shuffled = [...queries].sort(() => 0.5 - Math.random())
      const selected = shuffled.slice(0, Math.min(max, queries.length))
      return selected.map(q => ({ ...q, _id: q._id!.toString() }))
    })
  }

  async submitPracticeAnswer(params: { userId: string; queryId: string; answer: string }): Promise<{
    correct: boolean
    feedbackLevel: 'correct' | 'partially_correct' | 'wrong'
    feedback: string
    detailedFeedback: string
    correctAnswer: string | null
    similarity: number
  }> {
    const normalizeAnswer = (sql: string) =>
      sql
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[\'"]/g, "'")
        .replace(/;/g, '')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s*=\s*/g, ' = ')
        .replace(/\s*>\s*/g, ' > ')
        .replace(/\s*<\s*/g, ' < ')
        .replace(/\s*!=\s*/g, ' != ')
        .replace(/\s*<=\s*/g, ' <= ')
        .replace(/\s*>=\s*/g, ' >= ')
        .replace(/\s*like\s*/gi, ' like ')
        .replace(/\s*is\s+not\s+null\s*/gi, ' is not null ')
        .replace(/\s*is\s+null\s*/gi, ' is null ')
        .replace(/\s*order\s+by\s*/gi, ' order by ')
        .replace(/\s*group\s+by\s*/gi, ' group by ')
        .trim()

    const analyzeSQL = (sql: string) => {
      const normalized = normalizeAnswer(sql)
      return {
        select: normalized.includes('select') ? normalized.match(/select\s+(.+?)(?=\s+from|\s+where|\s+order|\s+group|\s+having|$)/i)?.[1]?.trim() : null,
        from: normalized.includes('from') ? normalized.match(/from\s+(.+?)(?=\s+where|\s+order|\s+group|\s+having|$)/i)?.[1]?.trim() : null,
        where: normalized.includes('where') ? normalized.match(/where\s+(.+?)(?=\s+order|\s+group|\s+having|$)/i)?.[1]?.trim() : null,
        orderBy: normalized.includes('order by') ? normalized.match(/order by\s+(.+?)(?=\s+group|\s+having|$)/i)?.[1]?.trim() : null,
        groupBy: normalized.includes('group by') ? normalized.match(/group by\s+(.+?)(?=\s+having|$)/i)?.[1]?.trim() : null,
        having: normalized.includes('having') ? normalized.match(/having\s+(.+?)$/i)?.[1]?.trim() : null,
      }
    }

    const calculateSimilarity = (sql1: string, sql2: string) => {
      const p1 = analyzeSQL(sql1)
      const p2 = analyzeSQL(sql2)
      let score = 0
      let total = 0
      ;(Object.keys(p1) as (keyof typeof p1)[]).forEach((k) => {
        if (p1[k] && p2[k]) {
          total++
          if (p1[k] === p2[k]) score += 1
          else if ((p1[k] as string).includes(p2[k] as string) || (p2[k] as string).includes(p1[k] as string)) score += 0.5
        }
      })
      return total > 0 ? score / total : 0
    }

    return executeWithRetry(async (db) => {
      const objectId = new ObjectId(params.queryId)
      let query = await db.collection<PracticeQueryDoc>(COLLECTIONS.PRACTICE_QUERIES).findOne({ _id: objectId })
      if (!query) {
        query = await db.collection<PracticeQueryDoc>(COLLECTIONS.PRACTICE_QUERIES).findOne({ _id: params.queryId as any })
      }
      if (!query) {
        throw new Error('Query not found')
      }

      const normalizedUser = normalizeAnswer(params.answer)
      const normalizedCorrect = normalizeAnswer(query.answerSql)
      const isCorrect = normalizedUser === normalizedCorrect
      const similarity = calculateSimilarity(params.answer, query.answerSql)

      let feedbackLevel: 'correct' | 'partially_correct' | 'wrong' = 'wrong'
      let feedback = ''
      let showCorrect = false
      if (isCorrect) {
        feedbackLevel = 'correct'
        feedback = 'מצוין! תשובה נכונה לחלוטין! 🎉'
      } else if (similarity >= 0.7) {
        feedbackLevel = 'partially_correct'
        feedback = 'כמעט נכון! יש לך את הרעיון הנכון, אבל יש כמה דברים שצריך לתקן.'
        showCorrect = true
      } else if (similarity >= 0.4) {
        feedbackLevel = 'partially_correct'
        feedback = 'יש לך חלק מהרעיון נכון, אבל יש מקום לשיפור.'
        showCorrect = true
      } else {
        feedbackLevel = 'wrong'
        feedback = 'התשובה לא נכונה. כדאי לבדוק את המבנה של השאילתה.'
        showCorrect = true
      }

      const userParts = analyzeSQL(params.answer)
      const correctParts = analyzeSQL(query.answerSql)
      const issues: string[] = []
      if (!isCorrect) {
        if (!userParts.select && correctParts.select) issues.push('חסר SELECT או שהוא לא נכון')
        if (!userParts.from && correctParts.from) issues.push('חסר FROM או שם הטבלה לא נכון')
        if (correctParts.where && !userParts.where) issues.push('חסר תנאי WHERE')
        if (correctParts.orderBy && !userParts.orderBy) issues.push('חסר ORDER BY')
        if (correctParts.groupBy && !userParts.groupBy) issues.push('חסר GROUP BY')
      }
      const detailedFeedback = issues.length > 0 ? `בעיות שזוהו: ${issues.join(', ')}.` : ''

      await db.collection<PracticeAttemptDoc>(COLLECTIONS.PRACTICE_ATTEMPTS).insertOne({
        userId: params.userId,
        queryId: objectId,
        question: query.question,
        userAnswer: params.answer,
        correctAnswer: query.answerSql,
        isCorrect,
        feedbackLevel,
        similarity,
        timestamp: new Date(),
      })

      return {
        correct: isCorrect,
        feedbackLevel,
        feedback,
        detailedFeedback,
        correctAnswer: showCorrect ? query.answerSql : null,
        similarity: Math.round(similarity * 100),
      }
    })
  }
}

let practiceService: PracticeService | null = null

export async function getPracticeService(): Promise<PracticeService> {
  if (!practiceService) {
    const { db } = await connectToDatabase()
    practiceService = new PracticeService(db)
  }
  return practiceService
}

export async function getPracticeTables() {
  const service = await getPracticeService()
  return service.getPracticeTables()
}

export async function getPracticeQueries(practiceId: string, max?: number) {
  const service = await getPracticeService()
  return service.getPracticeQueries(practiceId, max)
}

export async function submitPracticeAnswer(userId: string, queryId: string, answer: string) {
  const service = await getPracticeService()
  return service.submitPracticeAnswer({ userId, queryId, answer })
}


