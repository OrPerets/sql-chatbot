import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'
import {
  normalizeLearnerRecords,
  resolveLearnerIdentityFromDb,
} from '@/lib/learner-identity'

export interface ActivityData {
  userId: string
  activityType: 'chat' | 'homework' | 'login' | 'help_request' | 'practice' | 'quiz'
  activityData: {
    // Chat activities
    messageCount?: number
    topic?: string
    questionComplexity?: 'basic' | 'intermediate' | 'advanced'
    helpRequested?: boolean
    
    // Homework activities
    homeworkId?: string
    questionId?: string
    grade?: number
    timeSpent?: number
    attempts?: number
    errors?: string[]
    
    // Practice activities
    practiceType?: string
    difficulty?: string
    success?: boolean
    
    // Login activities
    loginMethod?: string
    sessionDuration?: number
    
    // Help request activities
    helpType?: string
    urgency?: 'low' | 'medium' | 'high'
    resolved?: boolean
    
    // General
    metadata?: any
  }
  sessionId?: string
  timestamp?: Date
}

export class ActivityTracker {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  /**
   * Track a student activity
   */
  async trackActivity(activity: ActivityData): Promise<void> {
    return executeWithRetry(async (db) => {
      const identity = await resolveLearnerIdentityFromDb(
        db,
        activity.userId,
        `activity-tracker.trackActivity.${activity.activityType}`
      )
      await normalizeLearnerRecords(
        db,
        identity,
        `activity-tracker.trackActivity.${activity.activityType}`
      )

      const activityRecord = {
        userId: identity.canonicalId,
        activityType: activity.activityType,
        activityData: activity.activityData,
        timestamp: activity.timestamp || new Date(),
        sessionId: activity.sessionId
      }

      // Insert activity record
      await db.collection(COLLECTIONS.STUDENT_ACTIVITIES).insertOne(activityRecord)

      // Update student profile based on activity type
      await this.updateProfileFromActivity({
        ...activity,
        userId: identity.canonicalId
      }, identity.email)
    })
  }

  /**
   * Update student profile based on activity
   */
  private async updateProfileFromActivity(activity: ActivityData, email?: string | null): Promise<void> {
    const now = new Date()
    const inc: Record<string, number> = {}
    const set: Record<string, unknown> = {
      lastActivity: now,
      updatedAt: now
    }
    const addToSet: Record<string, unknown> = {}
    const max: Record<string, unknown> = {}

    switch (activity.activityType) {
      case 'chat':
        inc['engagementMetrics.chatSessions'] = 1
        if (activity.activityData.helpRequested) {
          inc['engagementMetrics.helpRequests'] = 1
        }
        if (activity.activityData.messageCount) {
          max['engagementMetrics.averageSessionDuration'] = activity.activityData.messageCount
        }
        break

      case 'homework':
        inc['homeworkSubmissions'] = 1
        inc['totalQuestions'] = 1
        if (typeof activity.activityData.grade === 'number') {
          set['averageGrade'] = activity.activityData.grade
          if (activity.activityData.grade >= 60) {
            inc['correctAnswers'] = 1
          }
        }
        if (activity.activityData.errors && activity.activityData.errors.length > 0) {
          addToSet['commonChallenges'] = { $each: activity.activityData.errors }
        }
        break

      case 'practice':
        inc['totalQuestions'] = 1
        if (activity.activityData.success) {
          inc['correctAnswers'] = 1
        }
        break

      case 'help_request':
        inc['engagementMetrics.helpRequests'] = 1
        break

      case 'login':
        if (typeof activity.activityData.sessionDuration === 'number') {
          max['engagementMetrics.averageSessionDuration'] = activity.activityData.sessionDuration
        }
        break
    }

    await this.repairCorruptedProfileMetrics(activity.userId)

    const update: Record<string, unknown> = {
      $set: set,
      $setOnInsert: this.buildProfileDefaults(activity.userId, email)
    }

    if (Object.keys(inc).length > 0) {
      update.$inc = inc
    }
    if (Object.keys(addToSet).length > 0) {
      update.$addToSet = addToSet
    }
    if (Object.keys(max).length > 0) {
      update.$max = max
    }

    await this.db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
      { userId: activity.userId },
      update,
      { upsert: true }
    )
  }

  private buildProfileDefaults(userId: string, email?: string | null) {
    const now = new Date()
    return {
      userId,
      email: email || undefined,
      knowledgeScore: 'empty',
      knowledgeScoreHistory: [],
      totalQuestions: 0,
      correctAnswers: 0,
      homeworkSubmissions: 0,
      averageGrade: 0,
      commonChallenges: [],
      learningProgress: {
        sqlBasics: 0,
        joins: 0,
        aggregations: 0,
        subqueries: 0,
        advancedQueries: 0
      },
      engagementMetrics: {
        chatSessions: 0,
        averageSessionDuration: 0,
        helpRequests: 0,
        selfCorrections: 0
      },
      riskFactors: {
        isAtRisk: false,
        riskLevel: 'low',
        riskFactors: [],
        lastAssessment: now
      },
      conversationInsights: {
        totalSessions: 0,
        averageSessionDuration: 0,
        mostCommonTopics: [],
        learningTrend: 'stable',
        commonChallenges: [],
        overallEngagement: 'low',
        lastAnalysisDate: now
      },
      issueCount: 0,
      issueHistory: [],
      lastIssueUpdate: now,
      createdAt: now
    }
  }

  private async repairCorruptedProfileMetrics(userId: string): Promise<void> {
    const profile = await this.db.collection(COLLECTIONS.STUDENT_PROFILES).findOne({ userId })
    if (!profile) {
      return
    }

    const repairSet: Record<string, unknown> = {}
    const numericPaths = [
      'totalQuestions',
      'correctAnswers',
      'homeworkSubmissions',
      'averageGrade',
      'engagementMetrics.chatSessions',
      'engagementMetrics.averageSessionDuration',
      'engagementMetrics.helpRequests',
      'engagementMetrics.selfCorrections'
    ]

    numericPaths.forEach((path) => {
      const value = path.split('.').reduce<any>((current, key) => current?.[key], profile)
      if (value && typeof value === 'object' && Object.keys(value).some((key) => key.startsWith('$'))) {
        repairSet[path] = 0
      }
    })

    const commonChallenges = profile.commonChallenges
    if (
      commonChallenges &&
      typeof commonChallenges === 'object' &&
      !Array.isArray(commonChallenges) &&
      Object.keys(commonChallenges).some((key) => key.startsWith('$'))
    ) {
      repairSet.commonChallenges = []
    }

    if (Object.keys(repairSet).length > 0) {
      repairSet.updatedAt = new Date()
      console.warn('[activity-tracker] Repaired corrupted profile metric fields', {
        userId,
        repairedFields: Object.keys(repairSet)
      })
      await this.db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
        { userId },
        { $set: repairSet }
      )
    }
  }

  /**
   * Track chat activity
   */
  async trackChatActivity(
    userId: string,
    messageCount: number,
    topic?: string,
    questionComplexity?: 'basic' | 'intermediate' | 'advanced',
    helpRequested?: boolean,
    sessionId?: string
  ): Promise<void> {
    await this.trackActivity({
      userId,
      activityType: 'chat',
      activityData: {
        messageCount,
        topic,
        questionComplexity,
        helpRequested
      },
      sessionId
    })
  }

  /**
   * Track homework submission
   */
  async trackHomeworkSubmission(
    userId: string,
    homeworkId: string,
    questionId: string,
    grade: number,
    timeSpent: number,
    attempts: number,
    errors: string[],
    sessionId?: string
  ): Promise<void> {
    await this.trackActivity({
      userId,
      activityType: 'homework',
      activityData: {
        homeworkId,
        questionId,
        grade,
        timeSpent,
        attempts,
        errors
      },
      sessionId
    })
  }

  /**
   * Track practice activity
   */
  async trackPracticeActivity(
    userId: string,
    practiceType: string,
    difficulty: string,
    success: boolean,
    sessionId?: string
  ): Promise<void> {
    await this.trackActivity({
      userId,
      activityType: 'practice',
      activityData: {
        practiceType,
        difficulty,
        success
      },
      sessionId
    })
  }

  /**
   * Track login activity
   */
  async trackLoginActivity(
    userId: string,
    loginMethod: string,
    sessionDuration?: number,
    sessionId?: string
  ): Promise<void> {
    await this.trackActivity({
      userId,
      activityType: 'login',
      activityData: {
        loginMethod,
        sessionDuration
      },
      sessionId
    })
  }

  /**
   * Track help request
   */
  async trackHelpRequest(
    userId: string,
    helpType: string,
    urgency: 'low' | 'medium' | 'high',
    resolved: boolean,
    sessionId?: string
  ): Promise<void> {
    await this.trackActivity({
      userId,
      activityType: 'help_request',
      activityData: {
        helpType,
        urgency,
        resolved
      },
      sessionId
    })
  }

  /**
   * Get activity history for a student
   */
  async getStudentActivityHistory(
    userId: string,
    limit: number = 50,
    activityType?: string
  ): Promise<any[]> {
    return executeWithRetry(async (db) => {
      const identity = await resolveLearnerIdentityFromDb(
        db,
        userId,
        'activity-tracker.getStudentActivityHistory'
      )
      await normalizeLearnerRecords(db, identity, 'activity-tracker.getStudentActivityHistory')

      const filter: any = { userId: identity.canonicalId }
      if (activityType) {
        filter.activityType = activityType
      }

      const activities = await db.collection(COLLECTIONS.STUDENT_ACTIVITIES)
        .find(filter)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return activities
    })
  }

  /**
   * Get aggregated activity statistics
   */
  async getActivityStatistics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    return executeWithRetry(async (db) => {
      const matchFilter: any = {}
      
      if (userId) {
        const identity = await resolveLearnerIdentityFromDb(
          db,
          userId,
          'activity-tracker.getActivityStatistics'
        )
        await normalizeLearnerRecords(db, identity, 'activity-tracker.getActivityStatistics')
        matchFilter.userId = identity.canonicalId
      }
      
      if (startDate || endDate) {
        matchFilter.timestamp = {}
        if (startDate) matchFilter.timestamp.$gte = startDate
        if (endDate) matchFilter.timestamp.$lte = endDate
      }

      const pipeline = [
        { $match: matchFilter },
        {
          $group: {
            _id: '$activityType',
            count: { $sum: 1 },
            lastActivity: { $max: '$timestamp' }
          }
        },
        { $sort: { count: -1 } }
      ]

      const stats = await db.collection(COLLECTIONS.STUDENT_ACTIVITIES)
        .aggregate(pipeline)
        .toArray()

      return stats
    })
  }

  /**
   * Analyze student engagement patterns
   */
  async analyzeEngagementPatterns(userId: string): Promise<any> {
    return executeWithRetry(async (db) => {
      const identity = await resolveLearnerIdentityFromDb(
        db,
        userId,
        'activity-tracker.analyzeEngagementPatterns'
      )
      await normalizeLearnerRecords(db, identity, 'activity-tracker.analyzeEngagementPatterns')

      const pipeline = [
        { $match: { userId: identity.canonicalId } },
        {
          $group: {
            _id: {
              activityType: '$activityType',
              hour: { $hour: '$timestamp' },
              dayOfWeek: { $dayOfWeek: '$timestamp' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.activityType',
            hourlyPattern: {
              $push: {
                hour: '$_id.hour',
                count: '$count'
              }
            },
            weeklyPattern: {
              $push: {
                dayOfWeek: '$_id.dayOfWeek',
                count: '$count'
              }
            }
          }
        }
      ]

      const patterns = await db.collection(COLLECTIONS.STUDENT_ACTIVITIES)
        .aggregate(pipeline)
        .toArray()

      return patterns
    })
  }
}

let activityTracker: ActivityTracker | null = null

export async function getActivityTracker(): Promise<ActivityTracker> {
  if (!activityTracker) {
    const { db } = await connectToDatabase()
    activityTracker = new ActivityTracker(db)
  }
  return activityTracker
}

// Convenience functions
export async function trackActivity(activity: ActivityData) {
  const tracker = await getActivityTracker()
  return tracker.trackActivity(activity)
}

export async function trackChatActivity(
  userId: string,
  messageCount: number,
  topic?: string,
  questionComplexity?: 'basic' | 'intermediate' | 'advanced',
  helpRequested?: boolean,
  sessionId?: string
) {
  const tracker = await getActivityTracker()
  return tracker.trackChatActivity(userId, messageCount, topic, questionComplexity, helpRequested, sessionId)
}

export async function trackHomeworkSubmission(
  userId: string,
  homeworkId: string,
  questionId: string,
  grade: number,
  timeSpent: number,
  attempts: number,
  errors: string[],
  sessionId?: string
) {
  const tracker = await getActivityTracker()
  return tracker.trackHomeworkSubmission(userId, homeworkId, questionId, grade, timeSpent, attempts, errors, sessionId)
}

export async function trackLoginActivity(
  userId: string,
  loginMethod: string,
  sessionDuration?: number,
  sessionId?: string
) {
  const tracker = await getActivityTracker()
  return tracker.trackLoginActivity(userId, loginMethod, sessionDuration, sessionId)
}

export async function getStudentActivityHistory(userId: string, limit?: number, activityType?: string) {
  const tracker = await getActivityTracker()
  return tracker.getStudentActivityHistory(userId, limit, activityType)
}
