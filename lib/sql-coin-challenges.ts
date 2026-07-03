import { Db, ObjectId } from 'mongodb'

import { isPrivilegedUserRecord, normalizeAcademicPeriodInput, type AcademicPeriod } from '@/lib/academic-period'
import { COLLECTIONS, connectToDatabase, executeWithRetry } from '@/lib/database'
import { logCoinTransaction, updateCoinsBalance } from '@/lib/coins'
import type { PracticeQueryDoc } from '@/lib/practice'
import type { UserModel } from '@/lib/users'

export type SqlCoinChallengeStatus = 'pending' | 'active' | 'completed' | 'expired' | 'cancelled'

export interface SqlCoinChallengeQuestion {
  queryId: string
  practiceId: string
  table?: string
  difficulty?: string
  question: string
  answerSql: string
}

export interface SqlCoinChallengeAttempt {
  questionId: string
  answer: string
  correct: boolean
  feedbackLevel: 'correct' | 'partially_correct' | 'wrong'
  similarity: number
  submittedAt: string
}

export interface SqlCoinChallengeScore {
  correctCount: number
  totalQuestions: number
  passingCorrectCount: number
  passed: boolean
}

export interface SqlCoinChallengeDoc {
  _id?: ObjectId
  id: string
  studentId: string
  studentEmail: string
  year: number
  semester: number
  status: SqlCoinChallengeStatus
  questions: SqlCoinChallengeQuestion[]
  attempts: SqlCoinChallengeAttempt[]
  score?: SqlCoinChallengeScore
  coinLedgerTransactionId?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  activatedAt?: string
  completedAt?: string
  cancelledAt?: string
  expiresAt?: string
}

export interface PublicSqlCoinChallenge
  extends Omit<SqlCoinChallengeDoc, '_id' | 'questions'> {
  questions: Array<Omit<SqlCoinChallengeQuestion, 'answerSql'>>
}

export interface CreateSqlCoinChallengeInput {
  studentEmail: string
  academicPeriod: AcademicPeriod
  createdBy: string
  questionCount?: number
  practiceId?: string
}

export interface SubmitSqlCoinChallengeInput {
  challengeId: string
  user: UserModel
  answers: Array<{ questionId: string; answer: string }>
}

const DEFAULT_QUESTION_COUNT = 3

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function generateChallengeId(): string {
  return `sql_coin_${new ObjectId().toString()}`
}

function getStudentId(user: UserModel, fallbackEmail: string): string {
  const explicitId = normalizeText(user.id)
  if (explicitId) return explicitId
  const objectId = normalizeText(user._id?.toString())
  if (objectId) return objectId
  return fallbackEmail
}

function getAcademicPeriodFromUser(user: UserModel): AcademicPeriod | null {
  const year = Number(user.year)
  const semester = Number(user.semester)
  if (!Number.isFinite(year) || !Number.isFinite(semester) || year <= 0 || semester <= 0) {
    return null
  }
  return { year: Math.trunc(year), semester: Math.trunc(semester) }
}

function stripAnswers(challenge: SqlCoinChallengeDoc): PublicSqlCoinChallenge {
  const { _id, questions, ...rest } = challenge
  void _id
  return {
    ...rest,
    questions: questions.map(({ answerSql, ...question }) => {
      void answerSql
      return question
    }),
  }
}

function normalizeSqlAnswer(sql: string): string {
  return sql
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
}

function analyzeSql(sql: string) {
  const normalized = normalizeSqlAnswer(sql)
  return {
    select: normalized.includes('select') ? normalized.match(/select\s+(.+?)(?=\s+from|\s+where|\s+order|\s+group|\s+having|$)/i)?.[1]?.trim() : null,
    from: normalized.includes('from') ? normalized.match(/from\s+(.+?)(?=\s+where|\s+order|\s+group|\s+having|$)/i)?.[1]?.trim() : null,
    where: normalized.includes('where') ? normalized.match(/where\s+(.+?)(?=\s+order|\s+group|\s+having|$)/i)?.[1]?.trim() : null,
    orderBy: normalized.includes('order by') ? normalized.match(/order by\s+(.+?)(?=\s+group|\s+having|$)/i)?.[1]?.trim() : null,
    groupBy: normalized.includes('group by') ? normalized.match(/group by\s+(.+?)(?=\s+having|$)/i)?.[1]?.trim() : null,
    having: normalized.includes('having') ? normalized.match(/having\s+(.+?)$/i)?.[1]?.trim() : null,
  }
}

function calculateSimilarity(leftSql: string, rightSql: string): number {
  const left = analyzeSql(leftSql)
  const right = analyzeSql(rightSql)
  let score = 0
  let total = 0

  ;(Object.keys(left) as Array<keyof typeof left>).forEach((key) => {
    if (left[key] && right[key]) {
      total += 1
      if (left[key] === right[key]) {
        score += 1
      } else if (
        (left[key] as string).includes(right[key] as string) ||
        (right[key] as string).includes(left[key] as string)
      ) {
        score += 0.5
      }
    }
  })

  return total > 0 ? score / total : 0
}

function evaluateAnswer(question: SqlCoinChallengeQuestion, answer: string, submittedAt: string): SqlCoinChallengeAttempt {
  const normalizedUser = normalizeSqlAnswer(answer)
  const normalizedExpected = normalizeSqlAnswer(question.answerSql)
  const correct = normalizedUser === normalizedExpected
  const similarity = Math.round(calculateSimilarity(answer, question.answerSql) * 100)

  return {
    questionId: question.queryId,
    answer,
    correct,
    feedbackLevel: correct ? 'correct' : similarity >= 40 ? 'partially_correct' : 'wrong',
    similarity,
    submittedAt,
  }
}

function isExpired(challenge: SqlCoinChallengeDoc, now = new Date()): boolean {
  return Boolean(
    challenge.expiresAt &&
      (challenge.status === 'active' || challenge.status === 'pending') &&
      new Date(challenge.expiresAt).getTime() <= now.getTime()
  )
}

function withResolvedExpiry(challenge: SqlCoinChallengeDoc): SqlCoinChallengeDoc {
  return isExpired(challenge) ? { ...challenge, status: 'expired' } : challenge
}

export class SqlCoinChallengeService {
  constructor(private db: Db) {}

  async listChallenges(academicPeriod: AcademicPeriod): Promise<PublicSqlCoinChallenge[]> {
    return executeWithRetry(async (db) => {
      const docs = await db
        .collection<SqlCoinChallengeDoc>(COLLECTIONS.SQL_COIN_CHALLENGES)
        .find({ year: academicPeriod.year, semester: academicPeriod.semester })
        .sort({ createdAt: -1 })
        .toArray()

      return docs.map((doc) => stripAnswers(withResolvedExpiry(doc)))
    })
  }

  async createChallenge(input: CreateSqlCoinChallengeInput): Promise<PublicSqlCoinChallenge> {
    const studentEmail = normalizeEmail(input.studentEmail)
    const createdBy = normalizeEmail(input.createdBy)
    const questionCount = Math.max(1, Math.trunc(input.questionCount || DEFAULT_QUESTION_COUNT))

    if (!studentEmail) {
      throw new Error('studentEmail is required')
    }
    if (!createdBy) {
      throw new Error('createdBy is required')
    }

    const result = await executeWithRetry(async (db) => {
      const user = await db.collection<UserModel>(COLLECTIONS.USERS).findOne({
        email: { $regex: `^${escapeRegExp(studentEmail)}$`, $options: 'i' },
      } as never)

      if (!user) {
        return { ok: false as const, message: 'Student was not found' }
      }

      if (isPrivilegedUserRecord(user)) {
        return {
          ok: false as const,
          message: 'SQL coin challenges can only be opened for students',
        }
      }

      const userAcademicPeriod = normalizeAcademicPeriodInput(user)
      if (
        !userAcademicPeriod ||
        userAcademicPeriod.year !== input.academicPeriod.year ||
        userAcademicPeriod.semester !== input.academicPeriod.semester
      ) {
        return { ok: false as const, message: 'Student was not found in the selected cohort' }
      }

      const existing = await db.collection<SqlCoinChallengeDoc>(COLLECTIONS.SQL_COIN_CHALLENGES).findOne({
        studentEmail,
        year: input.academicPeriod.year,
        semester: input.academicPeriod.semester,
        status: { $in: ['pending', 'active'] },
      } as never)

      if (existing && !isExpired(existing)) {
        return { ok: true as const, challenge: stripAnswers(existing) }
      }

      const questionFilter = input.practiceId ? { practiceId: input.practiceId } : {}
      const questionDocs = await db
        .collection<PracticeQueryDoc>(COLLECTIONS.PRACTICE_QUERIES)
        .find(questionFilter)
        .sort({ practiceId: 1, _id: 1 })
        .limit(questionCount)
        .toArray()

      const questions = questionDocs
        .map((question) => {
          const queryId = normalizeText(question._id?.toString())
          return {
            queryId,
            practiceId: normalizeText(question.practiceId),
            table: normalizeText(question.table) || undefined,
            difficulty: normalizeText(question.difficulty) || undefined,
            question: normalizeText(question.question),
            answerSql: normalizeText(question.answerSql),
          }
        })
        .filter((question) => question.queryId && question.question && question.answerSql)

      if (questions.length < questionCount) {
        return {
          ok: false as const,
          message: 'Not enough SQL practice questions are available for a coin challenge',
        }
      }

      const now = new Date().toISOString()
      const challenge: SqlCoinChallengeDoc = {
        id: generateChallengeId(),
        studentId: getStudentId(user, studentEmail),
        studentEmail,
        year: input.academicPeriod.year,
        semester: input.academicPeriod.semester,
        status: 'active',
        questions,
        attempts: [],
        createdBy,
        createdAt: now,
        updatedAt: now,
        activatedAt: now,
      }

      await db.collection<SqlCoinChallengeDoc>(COLLECTIONS.SQL_COIN_CHALLENGES).insertOne(challenge)
      return { ok: true as const, challenge: stripAnswers(challenge) }
    })

    if (!result.ok) {
      throw new Error(result.message)
    }

    return result.challenge
  }

  async getCurrentChallengeForStudent(user: UserModel): Promise<PublicSqlCoinChallenge | null> {
    const studentEmail = normalizeEmail(user.email)
    const academicPeriod = getAcademicPeriodFromUser(user)
    if (!studentEmail || !academicPeriod) {
      return null
    }

    return executeWithRetry(async (db) => {
      const docs = await db
        .collection<SqlCoinChallengeDoc>(COLLECTIONS.SQL_COIN_CHALLENGES)
        .find({
          studentEmail,
          year: academicPeriod.year,
          semester: academicPeriod.semester,
        })
        .sort({ updatedAt: -1 })
        .toArray()

      const resolved = docs.map(withResolvedExpiry)
      const active = resolved.find((doc) => doc.status === 'active' || doc.status === 'pending')
      const latest = active ?? resolved[0] ?? null
      return latest ? stripAnswers(latest) : null
    })
  }

  async getChallengeForStudent(challengeId: string, user: UserModel): Promise<PublicSqlCoinChallenge | null> {
    const studentEmail = normalizeEmail(user.email)
    const academicPeriod = getAcademicPeriodFromUser(user)
    const id = normalizeText(challengeId)
    if (!studentEmail || !academicPeriod || !id) {
      return null
    }

    return executeWithRetry(async (db) => {
      const challenge = await db.collection<SqlCoinChallengeDoc>(COLLECTIONS.SQL_COIN_CHALLENGES).findOne({
        id,
        studentEmail,
        year: academicPeriod.year,
        semester: academicPeriod.semester,
      })

      return challenge ? stripAnswers(withResolvedExpiry(challenge)) : null
    })
  }

  async updateChallengeStatus(
    challengeId: string,
    status: Extract<SqlCoinChallengeStatus, 'active' | 'cancelled'>,
    academicPeriod: AcademicPeriod,
  ): Promise<PublicSqlCoinChallenge | null> {
    const id = normalizeText(challengeId)
    if (!id) {
      return null
    }

    const now = new Date().toISOString()
    const update: Partial<SqlCoinChallengeDoc> = {
      status,
      updatedAt: now,
      ...(status === 'active' ? { activatedAt: now, cancelledAt: undefined } : { cancelledAt: now }),
    }

    return executeWithRetry(async (db) => {
      const updated = await db.collection<SqlCoinChallengeDoc>(COLLECTIONS.SQL_COIN_CHALLENGES).findOneAndUpdate(
        {
          id,
          year: academicPeriod.year,
          semester: academicPeriod.semester,
          status: status === 'active' ? { $in: ['cancelled', 'expired'] } : { $in: ['pending', 'active'] },
        } as never,
        { $set: update },
        { returnDocument: 'after' },
      )

      return updated ? stripAnswers(updated) : null
    })
  }

  async submitChallenge(input: SubmitSqlCoinChallengeInput): Promise<PublicSqlCoinChallenge | null> {
    const studentEmail = normalizeEmail(input.user.email)
    const academicPeriod = getAcademicPeriodFromUser(input.user)
    const challengeId = normalizeText(input.challengeId)
    if (!studentEmail || !academicPeriod || !challengeId) {
      return null
    }

    const submittedAt = new Date().toISOString()

    return executeWithRetry(async (db) => {
      const collection = db.collection<SqlCoinChallengeDoc>(COLLECTIONS.SQL_COIN_CHALLENGES)
      const challenge = await collection.findOne({
        id: challengeId,
        studentEmail,
        year: academicPeriod.year,
        semester: academicPeriod.semester,
      })

      if (!challenge) {
        return null
      }

      const resolvedChallenge = withResolvedExpiry(challenge)
      if (resolvedChallenge.status === 'completed') {
        return stripAnswers(resolvedChallenge)
      }
      if (resolvedChallenge.status === 'cancelled' || resolvedChallenge.status === 'expired') {
        return stripAnswers(resolvedChallenge)
      }

      const answersByQuestionId = new Map(
        input.answers
          .map((answer) => [normalizeText(answer.questionId), normalizeText(answer.answer)] as const)
          .filter(([questionId, answer]) => Boolean(questionId && answer)),
      )

      if (answersByQuestionId.size < challenge.questions.length) {
        throw new Error('All challenge answers are required')
      }

      const attempts = challenge.questions.map((question) =>
        evaluateAnswer(question, answersByQuestionId.get(question.queryId) || '', submittedAt),
      )
      const correctCount = attempts.filter((attempt) => attempt.correct).length
      const score: SqlCoinChallengeScore = {
        correctCount,
        totalQuestions: challenge.questions.length,
        passingCorrectCount: challenge.questions.length,
        passed: correctCount === challenge.questions.length,
      }

      if (!score.passed) {
        const updated = await collection.findOneAndUpdate(
          { id: challenge.id, status: { $in: ['pending', 'active'] } } as never,
          { $set: { attempts, score, updatedAt: submittedAt } },
          { returnDocument: 'after' },
        )
        return updated ? stripAnswers(updated) : stripAnswers({ ...challenge, attempts, score, updatedAt: submittedAt })
      }

      const completed = await collection.findOneAndUpdate(
        {
          id: challenge.id,
          studentEmail,
          status: { $in: ['pending', 'active'] },
          coinLedgerTransactionId: { $exists: false },
        } as never,
        {
          $set: {
            status: 'completed',
            attempts,
            score,
            completedAt: submittedAt,
            updatedAt: submittedAt,
          },
        },
        { returnDocument: 'after' },
      )

      if (!completed) {
        const latest = await collection.findOne({ id: challenge.id, studentEmail })
        return latest ? stripAnswers(withResolvedExpiry(latest)) : null
      }

      await updateCoinsBalance([studentEmail], 1)
      const ledgerResult = await logCoinTransaction({
        user: studentEmail,
        delta: 1,
        reason: 'sql_coin_challenge_completed',
        createdBy: completed.createdBy,
        metadata: {
          challengeId: completed.id,
          year: completed.year,
          semester: completed.semester,
          questionCount: completed.questions.length,
          correctCount,
        },
      })
      const coinLedgerTransactionId = normalizeText((ledgerResult as any)?.insertedId?.toString?.())

      const finalChallenge = coinLedgerTransactionId
        ? await collection.findOneAndUpdate(
            { id: completed.id },
            { $set: { coinLedgerTransactionId, updatedAt: new Date().toISOString() } },
            { returnDocument: 'after' },
          )
        : completed

      return stripAnswers(finalChallenge || completed)
    })
  }
}

let challengeService: SqlCoinChallengeService | null = null

export async function getSqlCoinChallengeService(): Promise<SqlCoinChallengeService> {
  if (!challengeService) {
    const { db } = await connectToDatabase()
    challengeService = new SqlCoinChallengeService(db)
  }
  return challengeService
}

export async function listSqlCoinChallenges(academicPeriod: AcademicPeriod) {
  const service = await getSqlCoinChallengeService()
  return service.listChallenges(academicPeriod)
}

export async function createSqlCoinChallenge(input: CreateSqlCoinChallengeInput) {
  const service = await getSqlCoinChallengeService()
  return service.createChallenge(input)
}

export async function getCurrentSqlCoinChallengeForStudent(user: UserModel) {
  const service = await getSqlCoinChallengeService()
  return service.getCurrentChallengeForStudent(user)
}

export async function getSqlCoinChallengeForStudent(challengeId: string, user: UserModel) {
  const service = await getSqlCoinChallengeService()
  return service.getChallengeForStudent(challengeId, user)
}

export async function updateSqlCoinChallengeStatus(
  challengeId: string,
  status: Extract<SqlCoinChallengeStatus, 'active' | 'cancelled'>,
  academicPeriod: AcademicPeriod,
) {
  const service = await getSqlCoinChallengeService()
  return service.updateChallengeStatus(challengeId, status, academicPeriod)
}

export async function submitSqlCoinChallenge(input: SubmitSqlCoinChallengeInput) {
  const service = await getSqlCoinChallengeService()
  return service.submitChallenge(input)
}
