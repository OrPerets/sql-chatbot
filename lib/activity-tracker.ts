import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'
import { StudentProfilesService } from './student-profiles'

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
  private studentProfilesService: StudentProfilesService

  constructor(db: Db) {
    this.db = db
    this.studentProfilesService = new StudentProfilesService(db)
  }

  /**
   * Track a student activity
   */
  async trackActivity(activity: ActivityData): Promise<void> {
    return executeWithRetry(async (db) => {
      const activityRecord = {
        userId: activity.userId,
        activityType: activity.activityType,
        activityData: activity.activityData,
        timestamp: activity.timestamp || new Date(),
        sessionId: activity.sessionId
      }

      // Insert activity record
      await db.collection(COLLECTIONS.STUDENT_ACTIVITIES).insertOne(activityRecord)

      // Update student profile based on activity type
      await this.updateProfileFromActivity(activity)
    })
  }

  /**
   * Update student profile based on activity
   */
  private async updateProfileFromActivity(activity: ActivityData): Promise<void> {
    const updates: any = {
      lastActivity: new Date(),
      updatedAt: new Date()
    }

    switch (activity.activityType) {
      case 'chat':
        updates['engagementMetrics.chatSessions'] = { $inc: 1 }
        if (activity.activityData.messageCount) {
          updates['engagementMetrics.averageSessionDuration'] = { $inc: activity.activityData.messageCount }
        }
        if (activity.activityData.helpRequested) {
          updates['engagementMetrics.helpRequests'] = { $inc: 1 }
        }
        break

      case 'homework':
        updates['homeworkSubmissions'] = { $inc: 1 }
        updates['totalQuestions'] = { $inc: 1 }
        if (activity.activityData.grade !== undefined) {
          // Update average grade (simplified calculation)
          updates['averageGrade'] = activity.activityData.grade
        }
        if (activity.activityData.errors && activity.activityData.errors.length > 0) {
          updates['commonChallenges'] = { $addToSet: { $each: activity.activityData.errors } }
        }
        break

      case 'practice':
        updates['totalQuestions'] = { $inc: 1 }
        if (activity.activityData.success) {
          updates['correctAnswers'] = { $inc: 1 }
        }
        break

      case 'help_request':
        updates['engagementMetrics.helpRequests'] = { $inc: 1 }
        break
    }

    // Apply updates to student profile
    await this.db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
      { userId: activity.userId },
      { $set: updates }
    )
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
      const filter: any = { userId }
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
        matchFilter.userId = userId
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
      const pipeline = [
        { $match: { userId } },
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
