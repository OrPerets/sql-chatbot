import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'
import { getFreshnessLabel, getFreshnessScore, type FreshnessLabel } from '@/lib/freshness'
import {
  normalizeLearnerRecords,
  resolveLearnerIdentityFromDb,
} from '@/lib/learner-identity'
import {
  getLearnerTopicLabel,
  inferPrimaryLearnerTopic,
  type TopicMasteryRecord,
} from '@/lib/learner-model'
import { recalculateStudentProfile } from '@/lib/student-profile-recalculation'

export type StudentProfileEvidenceRecord = {
  computedAt: Date
  sources: string[]
  evidence: Record<string, unknown>
  confidence?: number
  freshnessScore?: number
  freshnessLabel?: FreshnessLabel
}

export type StudentIssueRecord = {
  issueId: string
  description: string
  detectedAt: Date
  resolvedAt?: Date
  severity: 'low' | 'medium' | 'high'
  confidence?: number
  source?: 'system' | 'ai' | 'admin'
  freshnessScore?: number
  freshnessLabel?: FreshnessLabel
  evidenceSummary?: string[]
  topic?: string | null
  falsePositive?: boolean
}

export type AdminOversightActionRecord = {
  id: string
  type:
    | 'confirm_weakness'
    | 'dismiss_false_positive'
    | 'set_temporary_intervention'
    | 'mark_student_goal'
    | 'force_recalibration'
  topic?: string | null
  note?: string | null
  goal?: string | null
  intervention?: string | null
  expiresAt?: Date | null
  recommendationId?: string | null
  createdAt: Date
  createdBy: string
}

export type StudentAdminOversight = {
  actions: AdminOversightActionRecord[]
  confirmedWeaknesses: Array<{
    topic: string
    notedAt: Date
    notedBy: string
    note?: string | null
  }>
  dismissedSignals: Array<{
    topic: string
    dismissedAt: Date
    dismissedBy: string
    note?: string | null
  }>
  interventions: Array<{
    id: string
    topic?: string | null
    intervention: string
    note?: string | null
    createdAt: Date
    createdBy: string
    expiresAt?: Date | null
    status: 'active' | 'expired'
  }>
  goalMarkers: Array<{
    id: string
    goal: string
    note?: string | null
    createdAt: Date
    createdBy: string
  }>
  recalibrationRequestedAt?: Date
  recalibrationRequestedBy?: string
  recalibrationReason?: string | null
}

export interface StudentProfile {
  _id?: any
  userId: string // Canonical reference to users collection
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
  issueHistory: StudentIssueRecord[]
  lastIssueUpdate: Date
  evidence?: Record<string, StudentProfileEvidenceRecord>
  topicMastery?: TopicMasteryRecord[]
  adminOversight?: StudentAdminOversight
  createdAt: Date
  updatedAt: Date
}

export interface StudentActivity {
  _id?: any
  userId: string
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

type AdminOversightActionInput = {
  actionType: AdminOversightActionRecord['type']
  topic?: string | null
  note?: string | null
  goal?: string | null
  intervention?: string | null
  expiresAt?: string | null
  recommendationId?: string | null
  createdBy?: string | null
}

function createDefaultAdminOversight(): StudentAdminOversight {
  return {
    actions: [],
    confirmedWeaknesses: [],
    dismissedSignals: [],
    interventions: [],
    goalMarkers: [],
  }
}

function toIsoDate(value: Date | null | undefined): Date | null {
  if (!value) {
    return null
  }

  return Number.isNaN(value.getTime()) ? null : value
}

function resolveTopicFromInput(value: string | null | undefined): { topic: string | null; label: string | null } {
  if (!value) {
    return { topic: null, label: null }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { topic: null, label: null }
  }

  const inferred = inferPrimaryLearnerTopic(trimmed)
  if (!inferred) {
    return { topic: trimmed, label: trimmed }
  }

  return {
    topic: inferred,
    label: getLearnerTopicLabel(inferred),
  }
}

function scoreFreshnessForNow() {
  return {
    freshnessScore: 1,
    freshnessLabel: 'fresh' as FreshnessLabel,
  }
}

export class StudentProfilesService {
  private db: Db

  constructor(db: Db) {
    this.db = db
  }

  private async resolveIdentity(userId: string, context: string) {
    const identity = await resolveLearnerIdentityFromDb(this.db, userId, context)
    await normalizeLearnerRecords(this.db, identity, context)
    return identity
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
        
        const userIds = users
          .map(user => user.id || user._id?.toString())
          .filter(Boolean)
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.getStudentProfile')
      const profile = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .findOne({ userId: identity.canonicalId })
      return profile
    })
  }

  async createStudentProfile(userId: string): Promise<StudentProfile> {
    return executeWithRetry(async (db) => {
      const now = new Date()
      const identity = await this.resolveIdentity(userId, 'student-profiles.createStudentProfile')
      
      // Get user data to include name and email
      const existingProfile = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .findOne({ userId: identity.canonicalId })
      if (existingProfile) {
        return existingProfile
      }

      const user = identity.user

      const profile: StudentProfile = {
        userId: identity.canonicalId,
        name: user?.name || user?.email?.split('@')[0] || 'ללא שם',
        email: user?.email || identity.email || 'ללא אימייל',
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
        evidence: {
          profileCreation: {
            computedAt: now,
            sources: ['users'],
            evidence: {
              canonicalUserId: identity.canonicalId,
              matchedBy: identity.matchedBy,
              email: identity.email
            },
            confidence: 0.98,
            freshnessScore: 1,
            freshnessLabel: 'fresh'
          }
        },
        topicMastery: [],
        adminOversight: {
          actions: [],
          confirmedWeaknesses: [],
          dismissedSignals: [],
          interventions: [],
          goalMarkers: [],
        },
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.updateKnowledgeScore')
      
      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId: identity.canonicalId },
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.updateStudentActivity')
      const activity: StudentActivity = {
        userId: identity.canonicalId,
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
          { userId: identity.canonicalId },
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.updateEngagementMetrics')
      const updateFields: any = {
        updatedAt: new Date()
      }
      
      // Set individual engagement metric fields
      if (metrics.chatSessions !== undefined) {
        updateFields['engagementMetrics.chatSessions'] = metrics.chatSessions
      }
      if (metrics.averageSessionDuration !== undefined) {
        updateFields['engagementMetrics.averageSessionDuration'] = metrics.averageSessionDuration
      }
      if (metrics.helpRequests !== undefined) {
        updateFields['engagementMetrics.helpRequests'] = metrics.helpRequests
      }
      if (metrics.selfCorrections !== undefined) {
        updateFields['engagementMetrics.selfCorrections'] = metrics.selfCorrections
      }

      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId: identity.canonicalId },
          {
            $set: updateFields
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.updateLearningProgress')
      const updateFields: any = {
        updatedAt: new Date()
      }
      
      // Set individual learning progress fields
      if (progress.sqlBasics !== undefined) {
        updateFields['learningProgress.sqlBasics'] = progress.sqlBasics
      }
      if (progress.joins !== undefined) {
        updateFields['learningProgress.joins'] = progress.joins
      }
      if (progress.aggregations !== undefined) {
        updateFields['learningProgress.aggregations'] = progress.aggregations
      }
      if (progress.subqueries !== undefined) {
        updateFields['learningProgress.subqueries'] = progress.subqueries
      }
      if (progress.advancedQueries !== undefined) {
        updateFields['learningProgress.advancedQueries'] = progress.advancedQueries
      }

      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId: identity.canonicalId },
          {
            $set: updateFields
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.updateRiskAssessment')
      const updateFields: any = {
        updatedAt: new Date()
      }
      
      // Set individual risk factor fields
      if (riskFactors.isAtRisk !== undefined) {
        updateFields['riskFactors.isAtRisk'] = riskFactors.isAtRisk
      }
      if (riskFactors.riskLevel !== undefined) {
        updateFields['riskFactors.riskLevel'] = riskFactors.riskLevel
      }
      if (riskFactors.riskFactors !== undefined) {
        updateFields['riskFactors.riskFactors'] = riskFactors.riskFactors
      }
      if (riskFactors.lastAssessment !== undefined) {
        updateFields['riskFactors.lastAssessment'] = riskFactors.lastAssessment
      }

      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId: identity.canonicalId },
          {
            $set: updateFields
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.updateConversationInsights')
      const updateFields: any = {
        updatedAt: new Date()
      }
      
      // Set individual conversation insight fields
      if (insights.totalSessions !== undefined) {
        updateFields['conversationInsights.totalSessions'] = insights.totalSessions
      }
      if (insights.averageSessionDuration !== undefined) {
        updateFields['conversationInsights.averageSessionDuration'] = insights.averageSessionDuration
      }
      if (insights.mostCommonTopics !== undefined) {
        updateFields['conversationInsights.mostCommonTopics'] = insights.mostCommonTopics
      }
      if (insights.learningTrend !== undefined) {
        updateFields['conversationInsights.learningTrend'] = insights.learningTrend
      }
      if (insights.commonChallenges !== undefined) {
        updateFields['conversationInsights.commonChallenges'] = insights.commonChallenges
      }
      if (insights.overallEngagement !== undefined) {
        updateFields['conversationInsights.overallEngagement'] = insights.overallEngagement
      }
      if (insights.lastAnalysisDate !== undefined) {
        updateFields['conversationInsights.lastAnalysisDate'] = insights.lastAnalysisDate
      }

      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .updateOne(
          { userId: identity.canonicalId },
          {
            $set: updateFields
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.getStudentActivityHistory')
      const activities = await db.collection<StudentActivity>(COLLECTIONS.STUDENT_ACTIVITIES)
        .find({ userId: identity.canonicalId })
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
          const canonicalUserId = user.id || user._id?.toString()
          if (!canonicalUserId) {
            continue
          }
          // Check if profile already exists
          const existingProfile = await db.collection(COLLECTIONS.STUDENT_PROFILES)
            .findOne({ userId: canonicalUserId })

          if (!existingProfile) {
            await this.createStudentProfile(canonicalUserId)
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
    severity: 'low' | 'medium' | 'high',
    metadata?: Partial<Pick<StudentIssueRecord, 'confidence' | 'source' | 'evidenceSummary' | 'topic'>>
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const identity = await this.resolveIdentity(userId, 'student-profiles.addIssue')
      const issueId = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()
      const confidence =
        typeof metadata?.confidence === 'number'
          ? metadata.confidence
          : severity === 'high'
            ? 0.86
            : severity === 'medium'
              ? 0.72
              : 0.58

      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES).updateOne(
        { userId: identity.canonicalId },
        {
          $push: {
            issueHistory: {
              issueId,
              description,
              detectedAt: now,
              severity,
              confidence,
              source: metadata?.source ?? 'ai',
              evidenceSummary: metadata?.evidenceSummary ?? [],
              topic: metadata?.topic ?? null,
              ...scoreFreshnessForNow(),
            } as StudentIssueRecord
          },
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
      const identity = await this.resolveIdentity(userId, 'student-profiles.resolveIssue')
      const now = new Date()

      const result = await db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
        { 
          userId: identity.canonicalId,
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
    issueHistory: StudentIssueRecord[]
  }> {
    return executeWithRetry(async (db) => {
      const identity = await this.resolveIdentity(userId, 'student-profiles.getStudentIssues')
      const profile = await db.collection(COLLECTIONS.STUDENT_PROFILES)
        .findOne({ userId: identity.canonicalId })

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

  async applyAdminOversightAction(
    userId: string,
    input: AdminOversightActionInput
  ): Promise<StudentProfile | null> {
    return executeWithRetry(async (db) => {
      const identity = await this.resolveIdentity(userId, 'student-profiles.applyAdminOversightAction')
      let profile = (await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .findOne({ userId: identity.canonicalId })) as StudentProfile | null

      if (!profile) {
        profile = await this.createStudentProfile(identity.canonicalId)
      }

      const now = new Date()
      const adminOversight = {
        ...createDefaultAdminOversight(),
        ...(profile.adminOversight ?? {}),
        actions: [...(profile.adminOversight?.actions ?? [])],
        confirmedWeaknesses: [...(profile.adminOversight?.confirmedWeaknesses ?? [])],
        dismissedSignals: [...(profile.adminOversight?.dismissedSignals ?? [])],
        interventions: [...(profile.adminOversight?.interventions ?? [])],
        goalMarkers: [...(profile.adminOversight?.goalMarkers ?? [])],
      }
      const topicMastery = [...(profile.topicMastery ?? [])]
      const commonChallenges = [...(profile.commonChallenges ?? [])]
      const evidence = { ...(profile.evidence ?? {}) }
      const createdBy = input.createdBy?.trim() || 'admin'
      const { topic, label } = resolveTopicFromInput(input.topic)

      const action: AdminOversightActionRecord = {
        id: `admin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: input.actionType,
        topic,
        note: input.note ?? null,
        goal: input.goal ?? null,
        intervention: input.intervention ?? null,
        expiresAt: input.expiresAt ? toIsoDate(new Date(input.expiresAt)) : null,
        recommendationId: input.recommendationId ?? null,
        createdAt: now,
        createdBy,
      }
      adminOversight.actions.push(action)

      if (input.actionType === 'confirm_weakness' && topic && label) {
        const existingIndex = topicMastery.findIndex((record) => record.topic === topic)
        const existing = existingIndex >= 0 ? topicMastery[existingIndex] : null
        const updatedRecord: TopicMasteryRecord = {
          topic: topic as TopicMasteryRecord['topic'],
          label,
          estimatedMastery: Math.min(existing?.estimatedMastery ?? 0.45, 0.45),
          confidence: Math.max(existing?.confidence ?? 0, 0.92),
          evidenceCount: (existing?.evidenceCount ?? 0) + 1,
          lastEvidenceTime: now,
          trend: existing?.trend === 'improving' ? 'stable' : existing?.trend ?? 'declining',
          strongestErrorTypes: existing?.strongestErrorTypes ?? [],
          weaknessKinds: Array.from(new Set([...(existing?.weaknessKinds ?? []), 'concept'])),
          status: 'measured',
          evidenceSummary: [
            input.note?.trim() || `Admin confirmed ${label} as a real weakness from the evidence console.`,
            ...(existing?.evidenceSummary ?? []),
          ].slice(0, 4),
          freshnessScore: 1,
          freshnessLabel: 'fresh',
        }

        if (existingIndex >= 0) {
          topicMastery[existingIndex] = updatedRecord
        } else {
          topicMastery.push(updatedRecord)
        }

        if (!commonChallenges.includes(label)) {
          commonChallenges.unshift(label)
        }

        adminOversight.confirmedWeaknesses.unshift({
          topic: label,
          notedAt: now,
          notedBy: createdBy,
          note: input.note ?? null,
        })
      }

      if (input.actionType === 'dismiss_false_positive' && topic && label) {
        const existingIndex = topicMastery.findIndex((record) => record.topic === topic)
        if (existingIndex >= 0) {
          topicMastery[existingIndex] = {
            ...topicMastery[existingIndex],
            confidence: Math.min(topicMastery[existingIndex].confidence, 0.22),
            status: 'insufficient_evidence',
            lastEvidenceTime: now,
            trend: 'unknown',
            evidenceSummary: [
              input.note?.trim() || `Admin marked ${label} as a false positive.`,
              ...topicMastery[existingIndex].evidenceSummary,
            ].slice(0, 4),
            freshnessScore: getFreshnessScore(now),
            freshnessLabel: getFreshnessLabel(getFreshnessScore(now)),
          }
        }

        const challengeIndex = commonChallenges.findIndex((challenge) => challenge === label || challenge === topic)
        if (challengeIndex >= 0) {
          commonChallenges.splice(challengeIndex, 1)
        }

        adminOversight.dismissedSignals.unshift({
          topic: label,
          dismissedAt: now,
          dismissedBy: createdBy,
          note: input.note ?? null,
        })
      }

      if (input.actionType === 'set_temporary_intervention' && input.intervention?.trim()) {
        adminOversight.interventions.unshift({
          id: action.id,
          topic: label ?? topic ?? null,
          intervention: input.intervention.trim(),
          note: input.note ?? null,
          createdAt: now,
          createdBy,
          expiresAt: action.expiresAt ?? null,
          status: action.expiresAt && action.expiresAt.getTime() < now.getTime() ? 'expired' : 'active',
        })
      }

      if (input.actionType === 'mark_student_goal' && input.goal?.trim()) {
        adminOversight.goalMarkers.unshift({
          id: action.id,
          goal: input.goal.trim(),
          note: input.note ?? null,
          createdAt: now,
          createdBy,
        })
      }

      if (input.actionType === 'force_recalibration') {
        adminOversight.recalibrationRequestedAt = now
        adminOversight.recalibrationRequestedBy = createdBy
        adminOversight.recalibrationReason = input.note ?? null
      }

      evidence.adminOversight = {
        computedAt: now,
        sources: ['admin_console'],
        evidence: {
          lastAction: action.type,
          topic: label ?? topic,
          note: input.note ?? null,
          intervention: input.intervention ?? null,
          goal: input.goal ?? null,
          activeInterventions: adminOversight.interventions
            .filter((item) => item.status === 'active')
            .slice(0, 5)
            .map((item) => item.intervention),
          markedGoals: adminOversight.goalMarkers.slice(0, 5).map((item) => item.goal),
        },
        confidence: 0.99,
        freshnessScore: 1,
        freshnessLabel: 'fresh',
      }

      await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES).updateOne(
        { userId: identity.canonicalId },
        {
          $set: {
            topicMastery: topicMastery.sort((left, right) => left.estimatedMastery - right.estimatedMastery),
            commonChallenges: commonChallenges.slice(0, 5),
            adminOversight,
            evidence,
            updatedAt: now,
          },
        }
      )

      if (input.actionType === 'force_recalibration') {
        await recalculateStudentProfile(db, identity.canonicalId)
      }

      return db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES)
        .findOne({ userId: identity.canonicalId })
    })
  }

  async updateKnowledgeScoreBasedOnIssues(
    userId: string,
    newScore: 'empty' | 'good' | 'needs_attention' | 'struggling',
    reason: string
  ): Promise<boolean> {
    return executeWithRetry(async (db) => {
      const identity = await this.resolveIdentity(userId, 'student-profiles.updateKnowledgeScoreBasedOnIssues')
      const now = new Date()

      const result = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES).updateOne(
        { userId: identity.canonicalId },
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
            } as StudentProfile['knowledgeScoreHistory'][0]
          }
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

export async function applyAdminOversightAction(userId: string, input: AdminOversightActionInput) {
  const service = await getStudentProfilesService()
  return service.applyAdminOversightAction(userId, input)
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
