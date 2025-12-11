import { Db, ObjectId } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'

export interface StudentProfile {
  _id?: any
  userId: any // Reference to users collection
  name?: string // User's name
  email?: string // User's email
  knowledgeScore: 'empty' | 'good' | 'needs_attention' | 'struggling'
  knowledgeScoreHistory: {
    score: string
    updatedAt: Date
    reason: string
    updatedBy: 'system' | 'admin' | 'ai'
  }[]
  lastActivity: Date
  totalQuestions: number
  correctAnswers: number
  homeworkSubmissions: number
  averageGrade: number
  commonChallenges: string[]
  learningProgress: {
    sqlBasics: number // 0-100 percentage
    joins: number
    aggregations: number
    subqueries: number
    advancedQueries: number
  }
  engagementMetrics: {
    chatSessions: number
    averageSessionDuration: number // in minutes
    helpRequests: number
    selfCorrections: number
  }
  riskFactors: {
    isAtRisk: boolean
    riskLevel: 'low' | 'medium' | 'high'
    riskFactors: string[]
    lastAssessment: Date
  }
  conversationInsights: {
    totalSessions: number
    averageSessionDuration: number
    mostCommonTopics: string[]
    learningTrend: 'improving' | 'stable' | 'declining'
    commonChallenges: string[]
    overallEngagement: 'low' | 'medium' | 'high'
    lastAnalysisDate: Date
  }
  // New fields for issue tracking system
  issueCount: number // Total number of identified issues
  issueHistory: Array<{
    issueId: string
    description: string
    detectedAt: Date
    resolvedAt?: Date
    severity: 'low' | 'medium' | 'high'
  }>
  lastIssueUpdate: Date
  createdAt: Date
  updatedAt: Date
}

export interface StudentActivity {
  _id?: any
  userId: any
  activityType: 'chat' | 'homework' | 'login' | 'help_request'
  activityData: any
  timestamp: Date
  sessionId?: string
}

export interface StudentAnalytics {
  totalStudents: number
  scoreDistribution: {
    empty: number
    good: number
    needs_attention: number
    struggling: number
  }
  riskDistribution: {
    low: number
    medium: number
    high: number
  }
  averageEngagement: number
  averageGrade: number
  topChallenges: string[]
}

export class StudentProfilesService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  // Student Profile Management
  async getAllStudentProfiles(
    page: number = 1,
    limit: number = 20,
    search?: string,
    knowledgeScore?: string,
    riskLevel?: string
  ): Promise<{ profiles: StudentProfile[]; total: number; page: number; totalPages: number }> {
    return executeWithRetry(async (db) => {
      const skip = (page - 1) * limit
      
      // Build filter query
      const filter: any = {}
      
      if (search) {
        // Search in user data by joining with users collection
        const users = await db.collection(COLLECTIONS.USERS)
          .find({
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { email: { $regex: search, $options: 'i' } }
            ]
          })
          .toArray()
        
        const userIds = users.map(user => user._id)
        filter.userId = { $in: userIds }
      }
      
      if (knowledgeScore) {
        filter.knowledgeScore = knowledgeScore
      }
      
      if (riskLevel) {
        filter['riskFactors.riskLevel'] = riskLevel
      }

      const [profiles, total] = await Promise.all([
        db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
          .find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
          .countDocuments(filter)
      ])

      return {
        profiles,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    })
  }

  async getStudentProfile(userId: string): Promise<StudentProfile | null> {
    return executeWithRetry(async (db) => {
      const profile = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .findOne({ userId: userId })
      return profile
    })
  }

  async createStudentProfile(userId: string): Promise<StudentProfile> {
    return executeWithRetry(async (db) => {
      const now = new Date()
      
      // Get user data to include name and email
      // Convert userId to ObjectId if it's a valid ObjectId string, otherwise try to find by email
      let user
      if (ObjectId.isValid(userId)) {
        user = await db.collection(COLLECTIONS.USERS).findOne({ _id: new ObjectId(userId) })
      } else {
        // If userId is not a valid ObjectId, try finding by email
        user = await db.collection(COLLECTIONS.USERS).findOne({ email: userId })
      }
      
      const profile: StudentProfile = {
        userId,
        name: user?.name || user?.email?.split('@')[0] || 'ללא שם',
        email: user?.email || 'ללא אימייל',
        knowledgeScore: 'empty',
        knowledgeScoreHistory: [{
          score: 'empty',
          updatedAt: now,
          reason: 'Initial profile creation',
          updatedBy: 'system'
        }],
        lastActivity: now,
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
        // Initialize new issue tracking fields
        issueCount: 0,
        issueHistory: [],
        lastIssueUpdate: now,
        createdAt: now,
        updatedAt: now
      }

      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .insertOne(profile)
      
      return { ...profile, _id: result.insertedId }
    })
  }

  async updateKnowledgeScore(
    userId: string, 
    newScore: 'empty' | 'good' | 'needs_attention' | 'struggling', 
    reason: string, 
    updatedBy: 'system' | 'admin' | 'ai'
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const now = new Date()
      
      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId },
          {
            $set: {
              knowledgeScore: newScore,
              updatedAt: now
            },
            $push: {
              knowledgeScoreHistory: {
                score: newScore,
                updatedAt: now,
                reason,
                updatedBy
              }
            } as any
          }
        )

      return result.modifiedCount > 0
    })
  }

  async updateStudentActivity(
    userId: string,
    activityType: string,
    activityData: any,
    sessionId?: string
  ): Promise<void> {
    return executeWithRetry(async (db) => {
      const activity: StudentActivity = {
        userId,
        activityType: activityType as any,
        activityData,
        timestamp: new Date(),
        sessionId
      }

      await db.collection<StudentActivity>(COLLECTIONS.STUDENT_ACTIVITIES)
        .insertOne(activity)

      // Update last activity in profile
      await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId },
          { 
            $set: { 
              lastActivity: new Date(),
              updatedAt: new Date()
            }
          }
        )
    })
  }

  async updateEngagementMetrics(
    userId: string,
    metrics: Partial<StudentProfile['engagementMetrics']>
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId },
          {
            $set: {
              'engagementMetrics': metrics as StudentProfile['engagementMetrics'],
              updatedAt: new Date()
            }
          }
        )

      return result.modifiedCount > 0
    })
  }

  async updateLearningProgress(
    userId: string,
    progress: Partial<StudentProfile['learningProgress']>
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId },
          {
            $set: {
              'learningProgress': progress as StudentProfile['learningProgress'],
              updatedAt: new Date()
            }
          }
        )

      return result.modifiedCount > 0
    })
  }

  async updateRiskAssessment(
    userId: string,
    riskFactors: Partial<StudentProfile['riskFactors']>
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId },
          {
            $set: {
              'riskFactors': riskFactors as StudentProfile['riskFactors'],
              updatedAt: new Date()
            }
          }
        )

      return result.modifiedCount > 0
    })
  }

  async updateConversationInsights(
    userId: string,
    insights: Partial<StudentProfile['conversationInsights']>
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId },
          {
            $set: {
              'conversationInsights': insights as StudentProfile['conversationInsights'],
              updatedAt: new Date()
            }
          }
        )

      return result.modifiedCount > 0
    })
  }

  // Analytics
  async getStudentAnalytics(): Promise<StudentAnalytics> {
    return executeWithRetry(async (db) => {
      const [
        totalStudents,
        scoreDistribution,
        riskDistribution,
        engagementData,
        gradeData,
        challengesData
      ] = await Promise.all([
        db.collection(COLLECTIONS.STUDENT_PROFILES).countDocuments(),
        
        db.collection(COLLECTIONS.STUDENT_PROFILES).aggregate([
          { $group: { _id: '$knowledgeScore', count: { $sum: 1 } } }
        ]).toArray(),
        
        db.collection(COLLECTIONS.STUDENT_PROFILES).aggregate([
          { $group: { _id: '$riskFactors.riskLevel', count: { $sum: 1 } } }
        ]).toArray(),
        
        db.collection(COLLECTIONS.STUDENT_PROFILES).aggregate([
          { $group: { _id: null, avgEngagement: { $avg: '$engagementMetrics.chatSessions' } } }
        ]).toArray(),
        
        db.collection(COLLECTIONS.STUDENT_PROFILES).aggregate([
          { $group: { _id: null, avgGrade: { $avg: '$averageGrade' } } }
        ]).toArray(),
        
        db.collection(COLLECTIONS.STUDENT_PROFILES).aggregate([
          { $unwind: '$commonChallenges' },
          { $group: { _id: '$commonChallenges', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]).toArray()
      ])

      // Process score distribution
      const scoreDist = {
        empty: 0,
        good: 0,
        needs_attention: 0,
        struggling: 0
      }
      scoreDistribution.forEach(item => {
        if (item._id in scoreDist) {
          scoreDist[item._id as keyof typeof scoreDist] = item.count
        }
      })

      // Process risk distribution
      const riskDist = {
        low: 0,
        medium: 0,
        high: 0
      }
      riskDistribution.forEach(item => {
        if (item._id in riskDist) {
          riskDist[item._id as keyof typeof riskDist] = item.count
        }
      })

      return {
        totalStudents,
        scoreDistribution: scoreDist,
        riskDistribution: riskDist,
        averageEngagement: engagementData[0]?.avgEngagement || 0,
        averageGrade: gradeData[0]?.avgGrade || 0,
        topChallenges: challengesData.map(item => item._id)
      }
    })
  }

  async getStudentActivityHistory(
    userId: string,
    limit: number = 50
  ): Promise<StudentActivity[]> {
    return executeWithRetry(async (db) => {
      const activities = await db.collection<StudentActivity>(COLLECTIONS.STUDENT_ACTIVITIES)
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return activities
    })
  }

  // Data Migration
  async migrateExistingUsers(): Promise<{ migrated: number; errors: string[] }> {
    return executeWithRetry(async (db) => {
      const users = await db.collection(COLLECTIONS.USERS).find({}).toArray()
      const errors: string[] = []
      let migrated = 0

      for (const user of users) {
        try {
          // Check if profile already exists
          const existingProfile = await db.collection(COLLECTIONS.STUDENT_PROFILES)
            .findOne({ userId: user._id })

          if (!existingProfile) {
            await this.createStudentProfile(user._id.toString())
            migrated++
          }
        } catch (error) {
          errors.push(`Failed to migrate user ${user.email}: ${error}`)
        }
      }

      return { migrated, errors }
    })
  }

  // Issue Management Methods
  async addIssue(
    userId: string,
    description: string,
    severity: 'low' | 'medium' | 'high'
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const issueId = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()

      const issueEntry = {
        issueId,
        description,
        detectedAt: now,
        severity
      }

      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES).updateOne(
        { userId },
        {
          $push: {
            issueHistory: issueEntry as StudentProfile['issueHistory'][0]
          } as any,
          $inc: { issueCount: 1 },
          $set: { 
            lastIssueUpdate: now,
            updatedAt: now
          }
        }
      )

      return result.modifiedCount > 0
    })
  }

  async resolveIssue(
    userId: string,
    issueId: string
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const now = new Date()

      const result = await db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
        { 
          userId,
          'issueHistory.issueId': issueId,
          'issueHistory.resolvedAt': { $exists: false }
        },
        {
          $set: {
            'issueHistory.$.resolvedAt': now,
            lastIssueUpdate: now,
            updatedAt: now
          }
        }
      )

      return result.modifiedCount > 0
    })
  }

  async getStudentIssues(userId: string): Promise<{
    totalIssues: number
    unresolvedIssues: number
    issueHistory: Array<{
      issueId: string
      description: string
      detectedAt: Date
      resolvedAt?: Date
      severity: 'low' | 'medium' | 'high'
    }>
  }> {
    return executeWithRetry(async (db) => {
      const profile = await db.collection(COLLECTIONS.STUDENT_PROFILES)
        .findOne({ userId })

      if (!profile) {
        return {
          totalIssues: 0,
          unresolvedIssues: 0,
          issueHistory: []
        }
      }

      const issueHistory = profile.issueHistory || []
      const unresolvedIssues = issueHistory.filter(issue => !issue.resolvedAt).length

      return {
        totalIssues: profile.issueCount || 0,
        unresolvedIssues,
        issueHistory
      }
    })
  }

  async updateKnowledgeScoreBasedOnIssues(
    userId: string,
    newScore: 'empty' | 'good' | 'needs_attention' | 'struggling',
    reason: string
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const now = new Date()

      const result = await db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
        { userId },
        {
          $set: {
            knowledgeScore: newScore,
            updatedAt: now
          },
          $push: {
            knowledgeScoreHistory: {
              score: newScore,
              updatedAt: now,
              reason,
              updatedBy: 'ai'
            }
          } as any
        }
      )

      return result.modifiedCount > 0
    })
  }
}

let studentProfilesService: StudentProfilesService | null = null

export async function getStudentProfilesService(): Promise<StudentProfilesService> {
  if (!studentProfilesService) {
    const { db } = await connectToDatabase()
    studentProfilesService = new StudentProfilesService(db)
  }
  return studentProfilesService
}

// Convenience functions
export async function getAllStudentProfiles(page?: number, limit?: number, search?: string, knowledgeScore?: string, riskLevel?: string) {
  const service = await getStudentProfilesService()
  return service.getAllStudentProfiles(page, limit, search, knowledgeScore, riskLevel)
}

export async function getStudentProfile(userId: string) {
  const service = await getStudentProfilesService()
  return service.getStudentProfile(userId)
}

export async function createStudentProfile(userId: string) {
  const service = await getStudentProfilesService()
  return service.createStudentProfile(userId)
}

export async function updateKnowledgeScore(userId: string, newScore: 'empty' | 'good' | 'needs_attention' | 'struggling', reason: string, updatedBy: 'system' | 'admin' | 'ai') {
  const service = await getStudentProfilesService()
  return service.updateKnowledgeScore(userId, newScore, reason, updatedBy)
}

export async function updateStudentActivity(userId: string, activityType: string, activityData: any, sessionId?: string) {
  const service = await getStudentProfilesService()
  return service.updateStudentActivity(userId, activityType, activityData, sessionId)
}

export async function getStudentAnalytics() {
  const service = await getStudentProfilesService()
  return service.getStudentAnalytics()
}

export async function migrateExistingUsers() {
  const service = await getStudentProfilesService()
  return service.migrateExistingUsers()
}
