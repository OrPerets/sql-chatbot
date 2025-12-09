import { Db } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'
import { StudentProfilesService } from './student-profiles'
import { ActivityTracker } from './activity-tracker'
import OpenAI from 'openai'

export interface AnalysisTriggers {
  conversationBased: {
    repeatedQuestions: number // 3+ questions on same topic
    helpRequestFrequency: number // 5+ help requests per session
    clarificationRequests: number // 3+ clarification requests
    stepByStepRequests: number // 2+ step-by-step guidance requests
  }
  performanceBased: {
    homeworkFailures: number // 2+ failed homework attempts
    errorFrequency: number // 5+ errors in single session
    timeSpentThreshold: number // 30+ minutes on single question
    gradeDecline: number // 20%+ grade drop over time
  }
  behavioralBased: {
    sessionFrequency: number // 3+ sessions per day
    engagementDrop: number // 50%+ drop in engagement
    avoidancePatterns: boolean // Avoiding certain topics
  }
}

export interface StudentAnalysis {
  studentId: string
  analysisDate: Date
  analysisType: 'scheduled' | 'triggered' | 'manual'
  triggerReason: string
  
  conversationSummary: {
    totalInteractions: number
    sessionCount: number
    repeatedTopics: string[]
    difficultyAreas: string[]
    helpRequestFrequency: number
    comprehensionLevel: 'low' | 'medium' | 'high'
  }
  
  performanceSummary: {
    homeworkGrades: number[]
    averageGrade: number
    gradeTrend: 'improving' | 'stable' | 'declining'
    errorPatterns: string[]
    improvementAreas: string[]
    strengths: string[]
    timeEfficiency: number // 0-100 score
  }
  
  challengeSummary: {
    primaryChallenges: string[]
    challengeSeverity: 'low' | 'medium' | 'high'
    riskFactors: string[]
    recommendations: string[]
    interventionNeeded: boolean
  }
  
  knowledgeScoreUpdate: {
    previousScore: string
    newScore: string
    confidenceLevel: number // 0-100
    reasoning: string
    supportingEvidence: string[]
    adminReviewRequired: boolean
  }
  
  michaelAnalysis: {
    rawResponse: string
    extractedInsights: string[]
    suggestedActions: string[]
    confidenceScore: number
  }
}

export interface AnalysisRequest {
  studentId: string
  analysisType: 'scheduled' | 'triggered' | 'manual'
  triggerReason: string
  conversationData?: any[]
  performanceData?: any[]
  previousAnalysis?: StudentAnalysis
}

export class AIAnalysisEngine {
  private db: Db
  private openai: OpenAI
  private studentProfilesService: StudentProfilesService
  private activityTracker: ActivityTracker
  private triggers: AnalysisTriggers

  constructor(db: Db) {
    this.db = db
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    this.studentProfilesService = new StudentProfilesService(db)
    this.activityTracker = new ActivityTracker(db)
    
    // Default trigger thresholds
    this.triggers = {
      conversationBased: {
        repeatedQuestions: 3,
        helpRequestFrequency: 5,
        clarificationRequests: 3,
        stepByStepRequests: 2
      },
      performanceBased: {
        homeworkFailures: 2,
        errorFrequency: 5,
        timeSpentThreshold: 30, // minutes
        gradeDecline: 20 // percentage
      },
      behavioralBased: {
        sessionFrequency: 3,
        engagementDrop: 50,
        avoidancePatterns: true
      }
    }
  }

  /**
   * Check if analysis should be triggered for a student
   */
  async checkTriggers(studentId: string): Promise<{ shouldAnalyze: boolean; reason: string }> {
    return executeWithRetry(async (db) => {
      // Get recent activities
      const recentActivities = await this.activityTracker.getStudentActivityHistory(studentId, 100)
      const profile = await this.studentProfilesService.getStudentProfile(studentId)
      
      if (!profile) {
        return { shouldAnalyze: false, reason: 'No profile found' }
      }

      // Check conversation-based triggers
      const chatActivities = recentActivities.filter(a => a.activityType === 'chat')
      const helpRequests = recentActivities.filter(a => a.activityType === 'help_request')
      
      if (helpRequests.length >= this.triggers.conversationBased.helpRequestFrequency) {
        return { shouldAnalyze: true, reason: `High help request frequency: ${helpRequests.length} requests` }
      }

      // Check performance-based triggers
      const homeworkActivities = recentActivities.filter(a => a.activityType === 'homework')
      const failedHomework = homeworkActivities.filter(a => 
        a.activityData.grade && a.activityData.grade < 60
      )
      
      if (failedHomework.length >= this.triggers.performanceBased.homeworkFailures) {
        return { shouldAnalyze: true, reason: `Multiple homework failures: ${failedHomework.length} failures` }
      }

      // Check grade decline
      if (profile.knowledgeScoreHistory.length >= 2) {
        const recentScores = profile.knowledgeScoreHistory.slice(-3)
        const hasDecline = this.detectGradeDecline(recentScores)
        if (hasDecline) {
          return { shouldAnalyze: true, reason: 'Significant grade decline detected' }
        }
      }

      // Check engagement drop
      const engagementDrop = this.detectEngagementDrop(profile, recentActivities)
      if (engagementDrop) {
        return { shouldAnalyze: true, reason: 'Significant engagement drop detected' }
      }

      return { shouldAnalyze: false, reason: 'No triggers met' }
    })
  }

  /**
   * Perform comprehensive student analysis using Michael assistant
   */
  async analyzeStudent(request: AnalysisRequest): Promise<StudentAnalysis> {
    return executeWithRetry(async (db) => {
      const analysisId = this.generateAnalysisId()
      const analysisDate = new Date()

      try {
        // Gather all relevant data
        const [profile, activities, conversationData, performanceData] = await Promise.all([
          this.studentProfilesService.getStudentProfile(request.studentId),
          this.activityTracker.getStudentActivityHistory(request.studentId, 200),
          this.getConversationData(request.studentId),
          this.getPerformanceData(request.studentId)
        ])

        if (!profile) {
          throw new Error('Student profile not found')
        }

        // Prepare data for Michael analysis
        const analysisData = this.prepareAnalysisData(profile, activities, conversationData, performanceData)

        // Send to Michael assistant for analysis
        const michaelResponse = await this.sendToMichaelAssistant(analysisData, request)

        // Process Michael's response
        const processedAnalysis = this.processMichaelResponse(michaelResponse, profile, request)

        // Calculate new knowledge score
        const scoreUpdate = this.calculateKnowledgeScoreUpdate(processedAnalysis, profile)

        // Detect and add issues based on analysis
        const detectedIssues = await this.detectAndAddIssues(
          request.studentId,
          processedAnalysis,
          profile
        )

        // Create comprehensive analysis result
        const analysis: StudentAnalysis = {
          studentId: request.studentId,
          analysisDate,
          analysisType: request.analysisType,
          triggerReason: request.triggerReason,
          conversationSummary: processedAnalysis.conversationSummary,
          performanceSummary: processedAnalysis.performanceSummary,
          challengeSummary: processedAnalysis.challengeSummary,
          knowledgeScoreUpdate: scoreUpdate,
          michaelAnalysis: {
            rawResponse: michaelResponse,
            extractedInsights: processedAnalysis.insights,
            suggestedActions: processedAnalysis.actions,
            confidenceScore: processedAnalysis.confidence
          }
        }

        // Save analysis result
        await this.saveAnalysisResult(analysis)

        // Update student profile if confidence is high enough
        if (scoreUpdate.confidenceLevel >= 70 && !scoreUpdate.adminReviewRequired) {
          await this.studentProfilesService.updateKnowledgeScore(
            request.studentId,
            scoreUpdate.newScore,
            scoreUpdate.reasoning,
            'ai'
          )
        }

        // Update knowledge score based on detected issues
        if (detectedIssues.length > 0) {
          await this.updateKnowledgeScoreBasedOnIssues(
            request.studentId,
            detectedIssues,
            profile
          )
        }

        return analysis

      } catch (error) {
        console.error('AI Analysis failed:', error)
        throw error
      }
    })
  }

  /**
   * Send analysis request to Michael assistant
   */
  private async sendToMichaelAssistant(analysisData: any, request: AnalysisRequest): Promise<string> {
    const prompt = this.buildAnalysisPrompt(analysisData, request)
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are Michael, an expert SQL teaching assistant and educational analyst. Your task is to analyze student learning patterns and provide insights for improving their SQL education experience.

You should focus on:
1. Identifying learning challenges and patterns
2. Assessing comprehension levels
3. Recommending interventions
4. Suggesting knowledge score updates
5. Providing actionable insights for educators

Respond in a structured format that can be parsed programmatically.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })

      return response.choices[0]?.message?.content || 'No response from Michael'
    } catch (error) {
      console.error('Error calling Michael assistant:', error)
      throw new Error('Failed to get analysis from Michael assistant')
    }
  }

  /**
   * Build analysis prompt for Michael assistant
   */
  private buildAnalysisPrompt(analysisData: any, request: AnalysisRequest): string {
    return `
Please analyze the following student data and provide insights for their SQL learning journey:

STUDENT PROFILE:
- Current Knowledge Score: ${analysisData.profile.knowledgeScore}
- Total Questions: ${analysisData.profile.totalQuestions}
- Correct Answers: ${analysisData.profile.correctAnswers}
- Average Grade: ${analysisData.profile.averageGrade}
- Common Challenges: ${Array.isArray(analysisData.profile.commonChallenges) ? analysisData.profile.commonChallenges.join(', ') : 'None'}
- Learning Progress: ${JSON.stringify(analysisData.profile.learningProgress)}
- Engagement Metrics: ${JSON.stringify(analysisData.profile.engagementMetrics)}
- Risk Factors: ${JSON.stringify(analysisData.profile.riskFactors)}

RECENT ACTIVITIES (${analysisData.activities.length} activities):
${analysisData.activities.slice(0, 20).map((activity: any) => 
  `- ${activity.activityType}: ${JSON.stringify(activity.activityData)}`
).join('\n')}

CONVERSATION DATA:
${analysisData.conversationData ? JSON.stringify(analysisData.conversationData.slice(0, 10)) : 'No conversation data available'}

PERFORMANCE DATA:
${analysisData.performanceData ? JSON.stringify(analysisData.performanceData) : 'No performance data available'}

ANALYSIS REQUEST:
- Type: ${request.analysisType}
- Trigger: ${request.triggerReason}

Please provide your analysis in the following JSON format:
{
  "conversationSummary": {
    "totalInteractions": number,
    "sessionCount": number,
    "repeatedTopics": string[],
    "difficultyAreas": string[],
    "helpRequestFrequency": number,
    "comprehensionLevel": "low" | "medium" | "high"
  },
  "performanceSummary": {
    "homeworkGrades": number[],
    "averageGrade": number,
    "gradeTrend": "improving" | "stable" | "declining",
    "errorPatterns": string[],
    "improvementAreas": string[],
    "strengths": string[],
    "timeEfficiency": number
  },
  "challengeSummary": {
    "primaryChallenges": string[],
    "challengeSeverity": "low" | "medium" | "high",
    "riskFactors": string[],
    "recommendations": string[],
    "interventionNeeded": boolean
  },
  "knowledgeScoreRecommendation": {
    "newScore": "empty" | "good" | "needs_attention" | "struggling",
    "confidence": number,
    "reasoning": string,
    "supportingEvidence": string[]
  },
  "detectedIssues": [
    {
      "description": "Specific issue description",
      "severity": "low" | "medium" | "high",
      "category": "comprehension" | "performance" | "engagement" | "behavioral"
    }
  ],
  "insights": string[],
  "actions": string[],
  "confidence": number
}
`
  }

  /**
   * Process Michael's response and extract structured data
   */
  private processMichaelResponse(response: string, profile: any, request: AnalysisRequest): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed
      }
    } catch (error) {
      console.error('Error parsing Michael response:', error)
    }

    // Fallback: create basic analysis from response text
    return {
      conversationSummary: {
        totalInteractions: 0,
        sessionCount: 0,
        repeatedTopics: [],
        difficultyAreas: [],
        helpRequestFrequency: 0,
        comprehensionLevel: 'medium' as const
      },
      performanceSummary: {
        homeworkGrades: [],
        averageGrade: profile.averageGrade,
        gradeTrend: 'stable' as const,
        errorPatterns: Array.isArray(profile.commonChallenges) ? profile.commonChallenges : [],
        improvementAreas: [],
        strengths: [],
        timeEfficiency: 50
      },
      challengeSummary: {
        primaryChallenges: Array.isArray(profile.commonChallenges) ? profile.commonChallenges : [],
        challengeSeverity: 'medium' as const,
        riskFactors: [],
        recommendations: [],
        interventionNeeded: false
      },
      detectedIssues: [],
      insights: ['Analysis completed with fallback processing'],
      actions: ['Review student progress manually'],
      confidence: 30
    }
  }

  /**
   * Calculate knowledge score update based on analysis
   */
  private calculateKnowledgeScoreUpdate(analysis: any, profile: any): any {
    const currentScore = profile.knowledgeScore
    let newScore = currentScore
    let confidence = analysis.confidence || 50
    let reasoning = 'No significant change detected'
    let supportingEvidence: string[] = []
    let adminReviewRequired = false

    // Determine new score based on analysis
    if (analysis.challengeSummary.challengeSeverity === 'high' && analysis.challengeSummary.interventionNeeded) {
      newScore = 'struggling'
      reasoning = 'High severity challenges detected requiring intervention'
      supportingEvidence = analysis.challengeSummary.riskFactors
      adminReviewRequired = true
    } else if (analysis.performanceSummary.gradeTrend === 'improving' && analysis.performanceSummary.averageGrade > 80) {
      newScore = 'good'
      reasoning = 'Consistent improvement and high performance detected'
      supportingEvidence = ['Improving grade trend', 'High average grade']
    } else if (analysis.challengeSummary.challengeSeverity === 'medium' || analysis.conversationSummary.comprehensionLevel === 'low') {
      newScore = 'needs_attention'
      reasoning = 'Moderate challenges or low comprehension detected'
      supportingEvidence = analysis.challengeSummary.primaryChallenges
    }

    // Adjust confidence based on data quality
    if (profile.totalQuestions < 5) {
      confidence = Math.min(confidence, 40)
      adminReviewRequired = true
    }

    return {
      previousScore: currentScore,
      newScore,
      confidenceLevel: confidence,
      reasoning,
      supportingEvidence,
      adminReviewRequired
    }
  }

  /**
   * Get conversation data for analysis
   */
  private async getConversationData(studentId: string): Promise<any[]> {
    return executeWithRetry(async (db) => {
      const messages = await db.collection(COLLECTIONS.CHAT_MESSAGES)
        .find({ userId: studentId })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray()
      
      return messages
    })
  }

  /**
   * Get performance data for analysis
   */
  private async getPerformanceData(studentId: string): Promise<any[]> {
    return executeWithRetry(async (db) => {
      const submissions = await db.collection(COLLECTIONS.SUBMISSIONS)
        .find({ studentId })
        .sort({ submittedAt: -1 })
        .limit(20)
        .toArray()
      
      return submissions
    })
  }

  /**
   * Prepare analysis data for Michael assistant
   */
  private prepareAnalysisData(profile: any, activities: any[], conversationData: any[], performanceData: any[]): any {
    return {
      profile,
      activities,
      conversationData,
      performanceData,
      summary: {
        totalActivities: activities.length,
        recentActivityTypes: this.getActivityTypeDistribution(activities),
        performanceTrend: this.calculatePerformanceTrend(performanceData),
        engagementLevel: this.calculateEngagementLevel(activities)
      }
    }
  }

  /**
   * Save analysis result to database
   */
  private async saveAnalysisResult(analysis: StudentAnalysis): Promise<void> {
    return executeWithRetry(async (db) => {
      await db.collection(COLLECTIONS.ANALYSIS_RESULTS).insertOne({
        ...analysis,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    })
  }

  /**
   * Helper methods
   */
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private detectGradeDecline(scores: any[]): boolean {
    if (scores.length < 2) return false
    
    const recent = scores.slice(-2)
    const decline = this.calculateScoreDecline(recent[0].score, recent[1].score)
    return decline >= this.triggers.performanceBased.gradeDecline
  }

  private detectEngagementDrop(profile: any, activities: any[]): boolean {
    // Simple engagement drop detection
    const recentActivities = activities.filter(a => 
      new Date(a.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    )
    
    const currentEngagement = recentActivities.length
    const historicalEngagement = profile.engagementMetrics.chatSessions / 30 // rough daily average
    
    return currentEngagement < (historicalEngagement * (1 - this.triggers.behavioralBased.engagementDrop / 100))
  }

  private calculateScoreDecline(oldScore: string, newScore: string): number {
    const scoreValues = { 'empty': 0, 'struggling': 1, 'needs_attention': 2, 'good': 3 }
    const oldValue = scoreValues[oldScore as keyof typeof scoreValues] || 0
    const newValue = scoreValues[newScore as keyof typeof scoreValues] || 0
    return Math.max(0, oldValue - newValue) * 25 // Convert to percentage
  }

  private getActivityTypeDistribution(activities: any[]): Record<string, number> {
    return activities.reduce((acc, activity) => {
      acc[activity.activityType] = (acc[activity.activityType] || 0) + 1
      return acc
    }, {})
  }

  private calculatePerformanceTrend(performanceData: any[]): string {
    if (performanceData.length < 2) return 'insufficient_data'
    
    const recent = performanceData.slice(0, 3)
    const older = performanceData.slice(3, 6)
    
    const recentAvg = recent.reduce((sum, p) => sum + (p.overallScore || 0), 0) / recent.length
    const olderAvg = older.reduce((sum, p) => sum + (p.overallScore || 0), 0) / older.length
    
    if (recentAvg > olderAvg + 5) return 'improving'
    if (recentAvg < olderAvg - 5) return 'declining'
    return 'stable'
  }

  private calculateEngagementLevel(activities: any[]): string {
    const chatActivities = activities.filter(a => a.activityType === 'chat')
    const helpRequests = activities.filter(a => a.activityType === 'help_request')
    
    if (helpRequests.length > chatActivities.length * 0.3) return 'high_help_seeking'
    if (chatActivities.length > 20) return 'high_engagement'
    if (chatActivities.length > 10) return 'medium_engagement'
    return 'low_engagement'
  }

  /**
   * Detect issues based on analysis and add them to student profile
   */
  private async detectAndAddIssues(
    studentId: string,
    analysis: any,
    profile: any
  ): Promise<Array<{ description: string; severity: 'low' | 'medium' | 'high' }>> {
    const detectedIssues: Array<{ description: string; severity: 'low' | 'medium' | 'high' }> = []

    // First, add issues detected by Michael assistant
    if (analysis.detectedIssues && Array.isArray(analysis.detectedIssues)) {
      for (const issue of analysis.detectedIssues) {
        detectedIssues.push({
          description: issue.description,
          severity: issue.severity
        })
      }
    }

    // Then add rule-based issues as backup/additional detection
    // Check for comprehension issues
    if (analysis.conversationSummary.comprehensionLevel === 'low') {
      const existingIssue = detectedIssues.find(issue => 
        issue.description.includes('comprehension level')
      )
      if (!existingIssue) {
        detectedIssues.push({
          description: 'Low comprehension level detected in conversations',
          severity: 'high'
        })
      }
    }

    // Check for performance issues
    if (analysis.performanceSummary.gradeTrend === 'declining') {
      const existingIssue = detectedIssues.find(issue => 
        issue.description.includes('performance trend')
      )
      if (!existingIssue) {
        detectedIssues.push({
          description: 'Declining performance trend detected',
          severity: 'medium'
        })
      }
    }

    // Check for high help request frequency
    if (analysis.conversationSummary.helpRequestFrequency > 5) {
      const existingIssue = detectedIssues.find(issue => 
        issue.description.includes('help requests')
      )
      if (!existingIssue) {
        detectedIssues.push({
          description: 'High frequency of help requests indicates struggling',
          severity: 'medium'
        })
      }
    }

    // Check for repeated difficulty areas
    if (analysis.conversationSummary.difficultyAreas.length > 3) {
      const existingIssue = detectedIssues.find(issue => 
        issue.description.includes('difficulty areas')
      )
      if (!existingIssue) {
        detectedIssues.push({
          description: `Multiple difficulty areas identified: ${analysis.conversationSummary.difficultyAreas.join(', ')}`,
          severity: 'high'
        })
      }
    }

    // Check for low engagement
    if (analysis.conversationSummary.comprehensionLevel === 'low' && 
        analysis.performanceSummary.averageGrade < 60) {
      const existingIssue = detectedIssues.find(issue => 
        issue.description.includes('engagement and poor performance')
      )
      if (!existingIssue) {
        detectedIssues.push({
          description: 'Low engagement and poor performance combination',
          severity: 'high'
        })
      }
    }

    // Check for error patterns
    if (analysis.performanceSummary.errorPatterns.length > 2) {
      const existingIssue = detectedIssues.find(issue => 
        issue.description.includes('error patterns')
      )
      if (!existingIssue) {
        detectedIssues.push({
          description: `Multiple error patterns detected: ${analysis.performanceSummary.errorPatterns.join(', ')}`,
          severity: 'medium'
        })
      }
    }

    // Add issues to student profile
    for (const issue of detectedIssues) {
      try {
        await this.studentProfilesService.addIssue(
          studentId,
          issue.description,
          issue.severity
        )
      } catch (error) {
        console.error('Error adding issue to student profile:', error)
      }
    }

    return detectedIssues
  }

  /**
   * Update knowledge score based on detected issues
   */
  private async updateKnowledgeScoreBasedOnIssues(
    studentId: string,
    detectedIssues: Array<{ description: string; severity: 'low' | 'medium' | 'high' }>,
    profile: any
  ): Promise<void> {
    const highSeverityIssues = detectedIssues.filter(issue => issue.severity === 'high')
    const mediumSeverityIssues = detectedIssues.filter(issue => issue.severity === 'medium')
    const lowSeverityIssues = detectedIssues.filter(issue => issue.severity === 'low')

    let newScore: 'empty' | 'good' | 'needs_attention' | 'struggling' = profile.knowledgeScore
    let reason = 'No significant issues detected'

    // Determine new knowledge score based on issue severity and count
    if (highSeverityIssues.length >= 2 || (highSeverityIssues.length >= 1 && mediumSeverityIssues.length >= 2)) {
      newScore = 'struggling'
      reason = `High severity issues detected: ${highSeverityIssues.length} high, ${mediumSeverityIssues.length} medium`
    } else if (highSeverityIssues.length >= 1 || mediumSeverityIssues.length >= 3) {
      newScore = 'needs_attention'
      reason = `Issues requiring attention: ${highSeverityIssues.length} high, ${mediumSeverityIssues.length} medium`
    } else if (lowSeverityIssues.length >= 3 && mediumSeverityIssues.length >= 1) {
      newScore = 'needs_attention'
      reason = `Multiple low-severity issues with some medium-severity concerns`
    } else if (detectedIssues.length === 0 && profile.knowledgeScore === 'empty') {
      // Only transition from empty if no issues are detected and there's sufficient data
      if (profile.totalQuestions >= 5 && profile.averageGrade >= 70) {
        newScore = 'good'
        reason = 'No issues detected with good performance indicators'
      }
    }

    // Update knowledge score if it changed
    if (newScore !== profile.knowledgeScore) {
      try {
        await this.studentProfilesService.updateKnowledgeScoreBasedOnIssues(
          studentId,
          newScore,
          reason
        )
      } catch (error) {
        console.error('Error updating knowledge score based on issues:', error)
      }
    }
  }
}

let aiAnalysisEngine: AIAnalysisEngine | null = null

export async function getAIAnalysisEngine(): Promise<AIAnalysisEngine> {
  if (!aiAnalysisEngine) {
    const { db } = await connectToDatabase()
    aiAnalysisEngine = new AIAnalysisEngine(db)
  }
  return aiAnalysisEngine
}

// Convenience functions
export async function checkAnalysisTriggers(studentId: string) {
  const engine = await getAIAnalysisEngine()
  return engine.checkTriggers(studentId)
}

export async function analyzeStudent(request: AnalysisRequest) {
  const engine = await getAIAnalysisEngine()
  return engine.analyzeStudent(request)
}
