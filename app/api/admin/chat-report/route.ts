import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from '@/lib/database'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

interface WeeklyChatReport {
  period: {
    startDate: string
    endDate: string
    days: number
  }
  summary: {
    totalUsersWithSessions: number
    totalSessions: number
    totalMessages: number
    averageMessagesPerUser: number
    averageMessagesPerSession: number
    averageSessionDuration: number
    medianSessionDuration: number
    averageUserDuration: number
    returningUsersPercentage: number
  }
  relationalAlgebra: {
    usersAskingAboutRA: number
    totalRAMessages: number
    percentageOfAllMessages: number
    sampleQuestions: Array<{
      userId: string
      userEmail?: string
      message: string
      timestamp: Date
      sessionId: string
    }>
    topTopics: Array<{
      topic: string
      count: number
    }>
  }
  dailyBreakdown: Array<{
    date: string
    sessions: number
    messages: number
    uniqueUsers: number
  }>
  usageFunnel: {
    visits: number
    firstQuestion: number
    followUp: number
    assignmentCompletion: number
  }
  cohorts: {
    newUsers: number
    returningUsers: number
    languageBreakdown: {
      hebrew: number
      english: number
      mixed: number
      other: number
    }
  }
  retention: {
    d1Retention: number
    d7Retention: number
    returningTrend: Array<{
      date: string
      returningUsers: number
      totalUsers: number
    }>
  }
  messageDepth: {
    averageThreadLength: number
    followUpRate: number
    averageUserMessages: number
    averageAssistantMessages: number
    averageTopicsPerSession: number
  }
  heatmap: {
    days: Array<{
      day: string
      counts: number[]
    }>
  }
  curriculumMapping: {
    chapters: Array<{
      chapter: string
      count: number
      topics: Array<{
        topic: string
        count: number
      }>
    }>
  }
  validation: {
    cappedSessions: number
    excludedSessions: number
    flaggedAverage: boolean
  }
  userDetails: Array<{
    userId: string
    userEmail?: string
    sessionCount: number
    messageCount: number
    hasRelationalAlgebraQuestions: boolean
  }>
  exportedAt: string
}

// Keywords to identify relational algebra related messages
const RELATIONAL_ALGEBRA_KEYWORDS = [
  'אלגברה יחסית',
  'אלגברה רלציונית',
  'אלגברה רילציונית',
  'relational algebra',
  'אלגברת יחסים',
  'רלציונל אלגברה',
  'selection',
  'projection',
  'join',
  'union',
  'intersection',
  'difference',
  'cartesian product',
  'σ',
  'π',
  '⋈',
  '∪',
  '∩',
  '−',
  '×',
  'בחירה',
  'הקטנה',
  'צירוף',
  'איחוד',
  'חיתוך',
  'הפרש',
  'מכפלה קרטזית'
]

const SESSION_DURATION_CAP_MS = 2 * 60 * 60 * 1000
const SESSION_DURATION_OUTLIER_MS = 8 * 60 * 60 * 1000
const ASSIGNMENT_KEYWORDS = ['assignment', 'homework', 'exercise', 'תרגיל', 'מטלה', 'הגשתי', 'submitted', 'submit']
const WEEKDAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

function isRelationalAlgebraMessage(text: string): boolean {
  const lowerText = text.toLowerCase()
  return RELATIONAL_ALGEBRA_KEYWORDS.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  )
}

// Helper function to check if a string is a valid ObjectId
function isValidObjectId(str: string): boolean {
  return ObjectId.isValid(str) && str.length === 24
}

function extractTopicFromMessage(text: string): string {
  const lowerText = text.toLowerCase()
  
  // Check for specific relational algebra operations
  if (lowerText.includes('selection') || lowerText.includes('בחירה') || lowerText.includes('σ')) {
    return 'Selection (בחירה)'
  }
  if (lowerText.includes('projection') || lowerText.includes('הקטנה') || lowerText.includes('π')) {
    return 'Projection (הקטנה)'
  }
  if (lowerText.includes('join') || lowerText.includes('צירוף') || lowerText.includes('⋈')) {
    return 'Join (צירוף)'
  }
  if (lowerText.includes('union') || lowerText.includes('איחוד') || lowerText.includes('∪')) {
    return 'Union (איחוד)'
  }
  if (lowerText.includes('intersection') || lowerText.includes('חיתוך') || lowerText.includes('∩')) {
    return 'Intersection (חיתוך)'
  }
  if (lowerText.includes('difference') || lowerText.includes('הפרש') || lowerText.includes('−')) {
    return 'Difference (הפרש)'
  }
  if (lowerText.includes('cartesian') || lowerText.includes('מכפלה') || lowerText.includes('×')) {
    return 'Cartesian Product (מכפלה קרטזית)'
  }
  
  return 'General Relational Algebra'
}

function detectLanguageBucket(text: string): 'hebrew' | 'english' | 'mixed' | 'other' {
  const hasHebrew = /[\u0590-\u05ff]/.test(text)
  const hasEnglish = /[a-zA-Z]/.test(text)

  if (hasHebrew && hasEnglish) return 'mixed'
  if (hasHebrew) return 'hebrew'
  if (hasEnglish) return 'english'
  return 'other'
}

function addDaysToDate(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  next.setHours(0, 0, 0, 0)
  return next
}

const CURRICULUM_MAP: Record<string, string> = {
  'Selection (בחירה)': 'פרק 2: אופרטורים בסיסיים',
  'Projection (הקטנה)': 'פרק 2: אופרטורים בסיסיים',
  'Join (צירוף)': 'פרק 3: צירופים מתקדמים',
  'Union (איחוד)': 'פרק 4: אופרטורי סט',
  'Intersection (חיתוך)': 'פרק 4: אופרטורי סט',
  'Difference (הפרש)': 'פרק 4: אופרטורי סט',
  'Cartesian Product (מכפלה קרטזית)': 'פרק 1: יסודות מודל רלציוני',
  'General Relational Algebra': 'פרק 1: יסודות מודל רלציוני'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const format = searchParams.get('format') || 'json'
    const includeDetails = searchParams.get('includeDetails') === 'true'

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)

    const report = await executeWithRetry(async (db) => {
      // Get all sessions from the last week
      const sessions = await db.collection(COLLECTIONS.CHAT_SESSIONS)
        .find({
          $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { lastMessageTimestamp: { $gte: startDate, $lte: endDate } }
          ]
        })
        .toArray()

      const sessionIds = sessions.map(s => s._id)
      const userIds = Array.from(new Set(sessions.map(s => s.userId)))

      // Get all messages from sessions in the last week
      const allMessages = await db.collection(COLLECTIONS.CHAT_MESSAGES)
        .find({
          chatId: { $in: sessionIds },
          timestamp: { $gte: startDate, $lte: endDate }
        })
        .sort({ timestamp: 1 })
        .toArray()

      // Get user emails for better reporting
      // Handle both ObjectId and string userIds
      const userIdStrings = userIds.map(id => {
        if (typeof id === 'string') return id
        if (id instanceof ObjectId) return id.toString()
        return String(id)
      })
      
      // Separate valid ObjectIds from other strings
      const validObjectIdStrings = userIdStrings.filter(id => isValidObjectId(id))
      const nonObjectIdStrings = userIdStrings.filter(id => !isValidObjectId(id))
      
      // Build query conditions
      const queryConditions: any[] = []
      
      // Add ObjectId query if we have valid ObjectIds
      if (validObjectIdStrings.length > 0) {
        queryConditions.push({
          _id: { $in: validObjectIdStrings.map(id => new ObjectId(id)) }
        })
      }
      
      // Add string query for non-ObjectId strings
      if (nonObjectIdStrings.length > 0) {
        queryConditions.push({
          _id: { $in: nonObjectIdStrings }
        })
      }
      
      // Also try email field if userIds might be emails
      if (nonObjectIdStrings.length > 0) {
        queryConditions.push({
          email: { $in: nonObjectIdStrings }
        })
      }
      
      const users = queryConditions.length > 0
        ? await db.collection(COLLECTIONS.USERS)
            .find({ $or: queryConditions })
            .toArray()
        : []

      const userEmailMap = new Map<string, string>()
      
      // Map users by their _id
      users.forEach(user => {
        const userId = user._id?.toString() || String(user._id)
        userEmailMap.set(userId, user.email || user.name || 'Unknown')
      })
      
      // Also map by email if userId is an email
      users.forEach(user => {
        if (user.email && !userEmailMap.has(user.email)) {
          userEmailMap.set(user.email, user.email)
        }
      })
      
      // Set default 'Unknown' for any userIds not found
      userIdStrings.forEach(userId => {
        if (!userEmailMap.has(userId)) {
          userEmailMap.set(userId, 'Unknown')
        }
      })

      // Filter relational algebra messages
      const raMessages = allMessages.filter(msg => 
        msg.role === 'user' && isRelationalAlgebraMessage(msg.text)
      )

      const sessionMessageMap = new Map<string, {
        userMessages: number
        assistantMessages: number
        totalMessages: number
        topics: Set<string>
      }>()

      const languageBreakdown = {
        hebrew: 0,
        english: 0,
        mixed: 0,
        other: 0
      }

      const heatmapBuckets = WEEKDAY_LABELS.map(() => Array.from({ length: 24 }).map(() => 0))

      // Extract topics from RA messages
      const topicCounts = new Map<string, number>()
      raMessages.forEach(msg => {
        const topic = extractTopicFromMessage(msg.text)
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
      })

      const topTopics = Array.from(topicCounts.entries())
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Get sample questions (first 20 user messages about RA)
      const sampleQuestions = raMessages
        .slice(0, 20)
        .map(msg => {
          const session = sessions.find(s => s._id?.toString() === msg.chatId?.toString())
          const userId = session?.userId ? String(session.userId) : 'unknown'
          return {
            userId,
            userEmail: userEmailMap.get(userId) || undefined,
            message: msg.text,
            timestamp: msg.timestamp,
            sessionId: msg.chatId?.toString() || 'unknown'
          }
        })

      // Get unique users asking about relational algebra
      const raUserIds = new Set(
        raMessages.map(msg => {
          const session = sessions.find(s => s._id?.toString() === msg.chatId?.toString())
          return session?.userId
        }).filter(Boolean)
      )

      // Daily breakdown
      const dailyBreakdownMap = new Map<string, {
        sessions: Set<string>
        messages: number
        users: Set<string>
      }>()

      sessions.forEach(session => {
        const dateKey = new Date(session.createdAt).toISOString().split('T')[0]
        if (!dailyBreakdownMap.has(dateKey)) {
          dailyBreakdownMap.set(dateKey, {
            sessions: new Set(),
            messages: 0,
            users: new Set()
          })
        }
        const day = dailyBreakdownMap.get(dateKey)!
        day.sessions.add(session._id?.toString() || '')
        day.users.add(session.userId)
      })

      allMessages.forEach(msg => {
        const dateKey = new Date(msg.timestamp).toISOString().split('T')[0]
        if (dailyBreakdownMap.has(dateKey)) {
          dailyBreakdownMap.get(dateKey)!.messages++
        }
      })

      const dailyBreakdown = Array.from(dailyBreakdownMap.entries())
        .map(([date, data]) => ({
          date,
          sessions: data.sessions.size,
          messages: data.messages,
          uniqueUsers: data.users.size
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // User details
      const userDetailsMap = new Map<string, {
        userId: string
        userEmail?: string
        sessionCount: number
        messageCount: number
        hasRelationalAlgebraQuestions: boolean
      }>()

      sessions.forEach(session => {
        const userId = String(session.userId)
        if (!userDetailsMap.has(userId)) {
          userDetailsMap.set(userId, {
            userId,
            userEmail: userEmailMap.get(userId),
            sessionCount: 0,
            messageCount: 0,
            hasRelationalAlgebraQuestions: false
          })
        }
        userDetailsMap.get(userId)!.sessionCount++
      })

      allMessages.forEach(msg => {
        const session = sessions.find(s => s._id?.toString() === msg.chatId?.toString())
        if (session) {
          const userId = String(session.userId)
          const userDetail = userDetailsMap.get(userId)
          const sessionId = session._id?.toString() || 'unknown'
          if (!sessionMessageMap.has(sessionId)) {
            sessionMessageMap.set(sessionId, {
              userMessages: 0,
              assistantMessages: 0,
              totalMessages: 0,
              topics: new Set()
            })
          }
          const sessionStats = sessionMessageMap.get(sessionId)!

          sessionStats.totalMessages++
          if (userDetail) {
            userDetail.messageCount++
            if (msg.role === 'user' && isRelationalAlgebraMessage(msg.text)) {
              userDetail.hasRelationalAlgebraQuestions = true
            }
          }

          if (msg.role === 'user') {
            sessionStats.userMessages++
            if (isRelationalAlgebraMessage(msg.text)) {
              sessionStats.topics.add(extractTopicFromMessage(msg.text))
            }
            const bucket = detectLanguageBucket(msg.text)
            languageBreakdown[bucket]++
            const timestamp = new Date(msg.timestamp)
            const dayIndex = timestamp.getDay()
            const hour = timestamp.getHours()
            if (heatmapBuckets[dayIndex]) {
              heatmapBuckets[dayIndex][hour] += 1
            }
          } else {
            sessionStats.assistantMessages++
          }
        }
      })

      const userDetails = Array.from(userDetailsMap.values())
        .sort((a, b) => b.messageCount - a.messageCount)

      // Calculate summary statistics
      const totalUsersWithSessions = userIds.length
      const totalSessions = sessions.length
      const totalMessages = allMessages.length
      const averageMessagesPerUser = totalUsersWithSessions > 0 
        ? totalMessages / totalUsersWithSessions 
        : 0
      const averageMessagesPerSession = totalSessions > 0 
        ? totalMessages / totalSessions 
        : 0

      const sessionDurations = sessions
        .map(session => {
          const createdAt = session.createdAt ? new Date(session.createdAt) : null
          const lastMessageTimestamp = session.lastMessageTimestamp
            ? new Date(session.lastMessageTimestamp)
            : createdAt
          if (!createdAt || !lastMessageTimestamp) return null
          const durationMs = Math.max(0, lastMessageTimestamp.getTime() - createdAt.getTime())
          return {
            userId: String(session.userId),
            durationMs
          }
        })
        .filter((entry): entry is { userId: string; durationMs: number } => Boolean(entry))

      let cappedSessions = 0
      let excludedSessions = 0
      const validatedDurations = sessionDurations
        .map(entry => {
          if (entry.durationMs > SESSION_DURATION_OUTLIER_MS) {
            excludedSessions += 1
            return null
          }
          if (entry.durationMs > SESSION_DURATION_CAP_MS) {
            cappedSessions += 1
          }
          return {
            ...entry,
            durationMs: Math.min(entry.durationMs, SESSION_DURATION_CAP_MS)
          }
        })
        .filter((entry): entry is { userId: string; durationMs: number } => Boolean(entry))

      const totalDurationMs = validatedDurations.reduce((sum, entry) => sum + entry.durationMs, 0)
      const averageSessionDuration = totalSessions > 0 ? totalDurationMs / totalSessions : 0

      const sortedDurations = validatedDurations
        .map(entry => entry.durationMs)
        .sort((a, b) => a - b)
      const medianSessionDuration = sortedDurations.length === 0
        ? 0
        : sortedDurations.length % 2 === 1
          ? sortedDurations[Math.floor(sortedDurations.length / 2)]
          : (sortedDurations[sortedDurations.length / 2 - 1] + sortedDurations[sortedDurations.length / 2]) / 2

      const userDurationMap = new Map<string, number>()
      validatedDurations.forEach(entry => {
        userDurationMap.set(entry.userId, (userDurationMap.get(entry.userId) || 0) + entry.durationMs)
      })
      const totalUserDuration = Array.from(userDurationMap.values()).reduce((sum, value) => sum + value, 0)
      const averageUserDuration = totalUsersWithSessions > 0 ? totalUserDuration / totalUsersWithSessions : 0

      const returningSessions = totalUsersWithSessions > 0
        ? await db.collection(COLLECTIONS.CHAT_SESSIONS)
            .find({
              userId: { $in: userIds },
              createdAt: { $lt: startDate }
            })
            .toArray()
        : []
      const returningUserIds = new Set(returningSessions.map(session => String(session.userId)))
      const returningUsersCount = Array.from(new Set(userIds.map(id => String(id))))
        .filter(userId => returningUserIds.has(userId)).length
      const returningUsersPercentage = totalUsersWithSessions > 0
        ? Math.round((returningUsersCount / totalUsersWithSessions) * 1000) / 10
        : 0

      const sessionMessageStats = Array.from(sessionMessageMap.values())
      const sessionsWithUserMessages = sessionMessageStats.filter(stats => stats.userMessages > 0).length
      const sessionsWithFollowUps = sessionMessageStats.filter(stats => stats.userMessages > 1).length
      const assignmentCompletionSessions = allMessages.filter(msg =>
        msg.role === 'user' &&
        ASSIGNMENT_KEYWORDS.some(keyword => msg.text.toLowerCase().includes(keyword))
      ).map(msg => msg.chatId?.toString()).filter(Boolean)
      const assignmentCompletionCount = new Set(assignmentCompletionSessions).size

      const averageThreadLength = totalSessions > 0 ? totalMessages / totalSessions : 0
      const averageUserMessages = totalSessions > 0
        ? sessionMessageStats.reduce((sum, stats) => sum + stats.userMessages, 0) / totalSessions
        : 0
      const averageAssistantMessages = totalSessions > 0
        ? sessionMessageStats.reduce((sum, stats) => sum + stats.assistantMessages, 0) / totalSessions
        : 0
      const followUpRate = sessionsWithUserMessages > 0
        ? (sessionsWithFollowUps / sessionsWithUserMessages) * 100
        : 0
      const averageTopicsPerSession = totalSessions > 0
        ? sessionMessageStats.reduce((sum, stats) => sum + stats.topics.size, 0) / totalSessions
        : 0

      const userSessionDates = new Map<string, Set<string>>()
      sessions.forEach(session => {
        const userId = String(session.userId)
        const dateKey = new Date(session.createdAt).toISOString().split('T')[0]
        if (!userSessionDates.has(userId)) {
          userSessionDates.set(userId, new Set())
        }
        userSessionDates.get(userId)!.add(dateKey)
      })

      let d1Count = 0
      let d7Count = 0
      userSessionDates.forEach((dates) => {
        const sorted = Array.from(dates).sort()
        if (sorted.length === 0) return
        const firstDate = new Date(sorted[0])
        const d1Key = addDaysToDate(firstDate, 1).toISOString().split('T')[0]
        const d7Key = addDaysToDate(firstDate, 7).toISOString().split('T')[0]
        if (dates.has(d1Key)) d1Count += 1
        if (dates.has(d7Key)) d7Count += 1
      })
      const d1Retention = totalUsersWithSessions > 0 ? (d1Count / totalUsersWithSessions) * 100 : 0
      const d7Retention = totalUsersWithSessions > 0 ? (d7Count / totalUsersWithSessions) * 100 : 0

      const dailyUsersMap = Array.from(dailyBreakdownMap.entries())
        .map(([date, data]) => ({
          date,
          users: Array.from(data.users).map(userId => String(userId))
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      const seenUsers = new Set<string>(Array.from(returningUserIds))
      const returningTrend = dailyUsersMap.map(day => {
        const returningUsers = day.users.filter(userId => seenUsers.has(userId)).length
        day.users.forEach(userId => seenUsers.add(userId))
        return {
          date: day.date,
          returningUsers,
          totalUsers: day.users.length
        }
      })

      const curriculumMap = new Map<string, { count: number; topics: Map<string, number> }>()
      topTopics.forEach(topicEntry => {
        const chapter = CURRICULUM_MAP[topicEntry.topic] || 'פרק 1: יסודות מודל רלציוני'
        if (!curriculumMap.has(chapter)) {
          curriculumMap.set(chapter, { count: 0, topics: new Map() })
        }
        const chapterEntry = curriculumMap.get(chapter)!
        chapterEntry.count += topicEntry.count
        chapterEntry.topics.set(topicEntry.topic, (chapterEntry.topics.get(topicEntry.topic) || 0) + topicEntry.count)
      })

      const curriculumMapping = Array.from(curriculumMap.entries()).map(([chapter, data]) => ({
        chapter,
        count: data.count,
        topics: Array.from(data.topics.entries()).map(([topic, count]) => ({ topic, count }))
      }))

      const averageDurationFlag = averageSessionDuration > SESSION_DURATION_CAP_MS || averageSessionDuration < 30 * 1000

      const reportData: WeeklyChatReport = {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          days
        },
        summary: {
          totalUsersWithSessions,
          totalSessions,
          totalMessages,
          averageMessagesPerUser: Math.round(averageMessagesPerUser * 100) / 100,
          averageMessagesPerSession: Math.round(averageMessagesPerSession * 100) / 100,
          averageSessionDuration: Math.round(averageSessionDuration),
          medianSessionDuration: Math.round(medianSessionDuration),
          averageUserDuration: Math.round(averageUserDuration),
          returningUsersPercentage
        },
        relationalAlgebra: {
          usersAskingAboutRA: raUserIds.size,
          totalRAMessages: raMessages.length,
          percentageOfAllMessages: totalMessages > 0 
            ? Math.round((raMessages.length / totalMessages) * 10000) / 100 
            : 0,
          sampleQuestions: includeDetails ? sampleQuestions : sampleQuestions.slice(0, 10),
          topTopics
        },
        dailyBreakdown,
        usageFunnel: {
          visits: totalSessions,
          firstQuestion: sessionsWithUserMessages,
          followUp: sessionsWithFollowUps,
          assignmentCompletion: assignmentCompletionCount
        },
        cohorts: {
          newUsers: totalUsersWithSessions - returningUsersCount,
          returningUsers: returningUsersCount,
          languageBreakdown
        },
        retention: {
          d1Retention: Math.round(d1Retention * 10) / 10,
          d7Retention: Math.round(d7Retention * 10) / 10,
          returningTrend
        },
        messageDepth: {
          averageThreadLength: Math.round(averageThreadLength * 10) / 10,
          followUpRate: Math.round(followUpRate * 10) / 10,
          averageUserMessages: Math.round(averageUserMessages * 10) / 10,
          averageAssistantMessages: Math.round(averageAssistantMessages * 10) / 10,
          averageTopicsPerSession: Math.round(averageTopicsPerSession * 10) / 10
        },
        heatmap: {
          days: WEEKDAY_LABELS.map((day, index) => ({
            day,
            counts: heatmapBuckets[index] || Array.from({ length: 24 }).map(() => 0)
          }))
        },
        curriculumMapping: {
          chapters: curriculumMapping
        },
        validation: {
          cappedSessions,
          excludedSessions,
          flaggedAverage: averageDurationFlag
        },
        userDetails: includeDetails ? userDetails : userDetails.slice(0, 50),
        exportedAt: new Date().toISOString()
      }

      return reportData
    })

    const filename = `chat-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.${format}`

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: report,
        filename,
        message: 'Weekly chat report generated successfully'
      })
    } else {
      // For CSV/Excel, return JSON that can be converted on frontend
      return NextResponse.json({
        success: true,
        data: report,
        filename,
        message: 'Data ready for export',
        format: 'json' // Frontend can convert to CSV/Excel
      })
    }

  } catch (error) {
    console.error('Error generating chat report:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate chat report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
