import { Db, ObjectId } from 'mongodb'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database'
import OpenAI from 'openai'

const DEFAULT_ANALYSIS_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini'
const DEFAULT_MAX_MESSAGES = 80
const DEFAULT_MAX_CHARS_PER_MESSAGE = 1200
const DEFAULT_MAX_TOTAL_CHARS = 48000

export interface ConversationSummary {
  _id?: ObjectId
  userId: string
  sessionId: string
  sessionTitle: string
  summaryPoints: string[] // 2-3 main bullet points
  keyTopics: string[] // SQL topics discussed
  learningIndicators: {
    comprehensionLevel: 'low' | 'medium' | 'high'
    helpSeekingBehavior: 'low' | 'medium' | 'high'
    engagementLevel: 'low' | 'medium' | 'high'
    challengeAreas: string[]
  }
  conversationMetadata: {
    messageCount: number
    sessionDuration: number // in minutes
    averageResponseTime: number // in seconds
    complexityLevel: 'basic' | 'intermediate' | 'advanced'
  }
  aiInsights: {
    rawAnalysis: string
    confidenceScore: number // 0-100
    recommendedActions: string[]
  }
  createdAt: Date
  updatedAt: Date
}

export interface ConversationAnalysisRequest {
  userId: string
  sessionId: string
  sessionTitle: string
  messages: Array<{
    role: 'user' | 'assistant'
    text: string
    timestamp: Date
  }>
  sessionDuration: number
}

export class ConversationSummaryService {
  private db: Db
  private openai: OpenAI

  constructor(db: Db) {
    this.db = db
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  /**
   * Analyze a conversation and create summary
   */
  async analyzeConversation(request: ConversationAnalysisRequest): Promise<ConversationSummary> {
    return executeWithRetry(async (db) => {
      try {
        // Prepare conversation data for AI analysis
        const conversationText = this.prepareConversationForAnalysis(request.messages)
        
        // Get AI analysis
        const aiAnalysis = await this.getAIAnalysis(conversationText, request)
        
        // Create conversation summary
        const summary: ConversationSummary = {
          userId: request.userId,
          sessionId: request.sessionId,
          sessionTitle: request.sessionTitle,
          summaryPoints: aiAnalysis.summaryPoints,
          keyTopics: aiAnalysis.keyTopics,
          learningIndicators: aiAnalysis.learningIndicators,
          conversationMetadata: {
            messageCount: request.messages.length,
            sessionDuration: request.sessionDuration,
            averageResponseTime: this.calculateAverageResponseTime(request.messages),
            complexityLevel: aiAnalysis.complexityLevel
          },
          aiInsights: {
            rawAnalysis: aiAnalysis.rawAnalysis,
            confidenceScore: aiAnalysis.confidenceScore,
            recommendedActions: aiAnalysis.recommendedActions
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }

        // Save to database
        const result = await db.collection<ConversationSummary>(COLLECTIONS.CONVERSATION_SUMMARIES)
          .insertOne(summary)

        return { ...summary, _id: result.insertedId }
      } catch (error) {
        console.error('Error analyzing conversation:', error)
        throw error
      }
    })
  }

  /**
   * Get conversation summaries for a student
   */
  async getStudentConversationSummaries(
    userId: string, 
    limit: number = 20
  ): Promise<ConversationSummary[]> {
    return executeWithRetry(async (db) => {
      return db.collection<ConversationSummary>(COLLECTIONS.CONVERSATION_SUMMARIES)
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()
    })
  }

  /**
   * Get conversation summary by session ID
   */
  async getConversationSummaryBySession(sessionId: string): Promise<ConversationSummary | null> {
    return executeWithRetry(async (db) => {
      return db.collection<ConversationSummary>(COLLECTIONS.CONVERSATION_SUMMARIES)
        .findOne({ sessionId })
    })
  }

  /**
   * Get aggregated insights for a student
   */
  async getStudentConversationInsights(userId: string): Promise<{
    totalSessions: number
    averageSessionDuration: number
    mostCommonTopics: string[]
    learningTrend: 'improving' | 'stable' | 'declining'
    commonChallenges: string[]
    overallEngagement: 'low' | 'medium' | 'high'
  }> {
    return executeWithRetry(async (db) => {
      const summaries = await db.collection<ConversationSummary>(COLLECTIONS.CONVERSATION_SUMMARIES)
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray()

      if (summaries.length === 0) {
        return {
          totalSessions: 0,
          averageSessionDuration: 0,
          mostCommonTopics: [],
          learningTrend: 'stable',
          commonChallenges: [],
          overallEngagement: 'low'
        }
      }

      // Calculate insights
      const totalSessions = summaries.length
      const averageSessionDuration = summaries.reduce((sum, s) => sum + s.conversationMetadata.sessionDuration, 0) / totalSessions
      
      // Most common topics
      const topicCounts: Record<string, number> = {}
      summaries.forEach(summary => {
        summary.keyTopics.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1
        })
      })
      const mostCommonTopics = Object.entries(topicCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic)

      // Common challenges
      const challengeCounts: Record<string, number> = {}
      summaries.forEach(summary => {
        summary.learningIndicators.challengeAreas.forEach(challenge => {
          challengeCounts[challenge] = (challengeCounts[challenge] || 0) + 1
        })
      })
      const commonChallenges = Object.entries(challengeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([challenge]) => challenge)

      // Learning trend (simplified)
      const recentEngagement = summaries.slice(0, 3).reduce((sum, s) => {
        const engagementScore = s.learningIndicators.engagementLevel === 'high' ? 3 : 
                               s.learningIndicators.engagementLevel === 'medium' ? 2 : 1
        return sum + engagementScore
      }, 0) / Math.min(3, summaries.length)

      const olderEngagement = summaries.slice(3, 6).reduce((sum, s) => {
        const engagementScore = s.learningIndicators.engagementLevel === 'high' ? 3 : 
                               s.learningIndicators.engagementLevel === 'medium' ? 2 : 1
        return sum + engagementScore
      }, 0) / Math.min(3, summaries.length - 3)

      let learningTrend: 'improving' | 'stable' | 'declining' = 'stable'
      if (recentEngagement > olderEngagement + 0.5) learningTrend = 'improving'
      else if (recentEngagement < olderEngagement - 0.5) learningTrend = 'declining'

      // Overall engagement
      const avgEngagement = summaries.reduce((sum, s) => {
        const engagementScore = s.learningIndicators.engagementLevel === 'high' ? 3 : 
                               s.learningIndicators.engagementLevel === 'medium' ? 2 : 1
        return sum + engagementScore
      }, 0) / totalSessions

      const overallEngagement = avgEngagement >= 2.5 ? 'high' : avgEngagement >= 1.5 ? 'medium' : 'low'

      return {
        totalSessions,
        averageSessionDuration: Math.round(averageSessionDuration),
        mostCommonTopics,
        learningTrend,
        commonChallenges,
        overallEngagement
      }
    })
  }

  /**
   * Get AI analysis of conversation
   */
  private async getAIAnalysis(conversationText: string, request: ConversationAnalysisRequest): Promise<{
    summaryPoints: string[]
    keyTopics: string[]
    learningIndicators: ConversationSummary['learningIndicators']
    complexityLevel: 'basic' | 'intermediate' | 'advanced'
    rawAnalysis: string
    confidenceScore: number
    recommendedActions: string[]
  }> {
    const model = (process.env.OPENAI_CONVERSATION_ANALYSIS_MODEL || DEFAULT_ANALYSIS_MODEL).trim()
    const systemPrompt = 'You are an expert SQL educator and learning analyst. Analyze student conversations to identify learning patterns, challenges, and opportunities for improvement. Provide specific, actionable insights.'
    const prompt = this.buildAnalysisPrompt(conversationText, request)

    const createAnalysis = async (analysisPrompt: string) => {
      const basePayload = {
        model,
        messages: [
          {
            role: 'system' as const,
            content: systemPrompt
          },
          {
            role: 'user' as const,
            content: analysisPrompt
          }
        ]
      }

      try {
        return await this.openai.chat.completions.create({
          ...basePayload,
          max_completion_tokens: 1500
        })
      } catch (error: any) {
        const message = String(error?.message || '').toLowerCase()
        const unsupportedMaxCompletionTokens =
          error?.code === 'unsupported_parameter' &&
          (error?.param === 'max_completion_tokens' || message.includes('max_completion_tokens'))

        if (!unsupportedMaxCompletionTokens) {
          throw error
        }

        return this.openai.chat.completions.create({
          ...basePayload,
          max_tokens: 1500
        })
      }
    }

    try {
      let response: OpenAI.Chat.Completions.ChatCompletion
      try {
        response = await createAnalysis(prompt)
      } catch (error: any) {
        const message = String(error?.message || '').toLowerCase()
        const isContextTooLarge =
          error?.code === 'context_length_exceeded' ||
          message.includes('maximum context length') ||
          message.includes('context length')

        if (!isContextTooLarge) {
          throw error
        }

        const fallbackConversationText = this.prepareConversationForAnalysis(request.messages, {
          maxMessages: 24,
          maxCharsPerMessage: 500,
          maxTotalChars: 12000
        })
        const fallbackPrompt = this.buildAnalysisPrompt(fallbackConversationText, request)
        response = await createAnalysis(fallbackPrompt)
      }

      const analysisText = response.choices[0]?.message?.content || 'No analysis available'
      
      // Try to parse JSON response
      try {
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return {
            summaryPoints: parsed.summaryPoints || ['Analysis completed'],
            keyTopics: parsed.keyTopics || [],
            learningIndicators: parsed.learningIndicators || {
              comprehensionLevel: 'medium',
              helpSeekingBehavior: 'medium',
              engagementLevel: 'medium',
              challengeAreas: []
            },
            complexityLevel: parsed.complexityLevel || 'intermediate',
            rawAnalysis: analysisText,
            confidenceScore: parsed.confidenceScore || 70,
            recommendedActions: parsed.recommendedActions || []
          }
        }
      } catch (parseError) {
        console.error('Error parsing AI analysis:', parseError)
      }

      // Fallback response
      return {
        summaryPoints: ['Conversation analyzed - detailed insights available in raw analysis'],
        keyTopics: ['SQL Learning'],
        learningIndicators: {
          comprehensionLevel: 'medium',
          helpSeekingBehavior: 'medium',
          engagementLevel: 'medium',
          challengeAreas: []
        },
        complexityLevel: 'intermediate',
        rawAnalysis: analysisText,
        confidenceScore: 50,
        recommendedActions: ['Review conversation details for specific insights']
      }
    } catch (error) {
      console.error('Error getting AI analysis:', error)
      throw new Error('Failed to analyze conversation with AI')
    }
  }

  private buildAnalysisPrompt(conversationText: string, request: ConversationAnalysisRequest): string {
    return `
Analyze the following SQL learning conversation and provide insights about the student's learning patterns.

CONVERSATION:
${conversationText}

SESSION METADATA:
- Duration: ${request.sessionDuration} minutes
- Message Count: ${request.messages.length}
- Session Title: ${request.sessionTitle}

Please provide your analysis in the following JSON format:
{
  "summaryPoints": [
    "2-3 key bullet points about the student's learning behavior, challenges, or progress",
    "Focus on specific observations about their SQL understanding",
    "Include any notable patterns or insights"
  ],
  "keyTopics": [
    "List of SQL topics discussed (e.g., 'SELECT queries', 'JOINs', 'aggregations')"
  ],
  "learningIndicators": {
    "comprehensionLevel": "low|medium|high",
    "helpSeekingBehavior": "low|medium|high", 
    "engagementLevel": "low|medium|high",
    "challengeAreas": ["specific areas where student struggled"]
  },
  "complexityLevel": "basic|intermediate|advanced",
  "confidenceScore": 85,
  "recommendedActions": [
    "Specific recommendations for helping this student improve"
  ]
}

Focus on:
1. Student's understanding level and comprehension
2. Areas where they struggled or excelled
3. Their help-seeking behavior and engagement
4. Specific SQL concepts that need attention
5. Actionable insights for educators
`
  }

  /**
   * Prepare conversation text for analysis
   */
  private prepareConversationForAnalysis(
    messages: Array<{role: string, text: string, timestamp: Date}>,
    limits?: { maxMessages?: number; maxCharsPerMessage?: number; maxTotalChars?: number }
  ): string {
    const maxMessages = limits?.maxMessages ?? DEFAULT_MAX_MESSAGES
    const maxCharsPerMessage = limits?.maxCharsPerMessage ?? DEFAULT_MAX_CHARS_PER_MESSAGE
    const maxTotalChars = limits?.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS
    const selected = messages.slice(-maxMessages)
    let truncatedAnyMessage = false

    let formatted = selected.map((msg, index) => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString()
      const normalizedText = String(msg.text || '').replace(/\s+/g, ' ').trim()
      const clippedText =
        normalizedText.length > maxCharsPerMessage
          ? `${normalizedText.slice(0, maxCharsPerMessage)}… [truncated]`
          : normalizedText
      if (clippedText !== normalizedText) {
        truncatedAnyMessage = true
      }
      return `${index + 1}. [${timestamp}] ${msg.role.toUpperCase()}: ${clippedText}`
    }).join('\n\n')

    let headTruncated = false
    if (formatted.length > maxTotalChars) {
      formatted = formatted.slice(formatted.length - maxTotalChars)
      headTruncated = true
    }

    if (headTruncated || truncatedAnyMessage || selected.length < messages.length) {
      return `[Conversation truncated for analysis: showing recent context only]\n\n${formatted}`
    }

    return formatted
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(messages: Array<{timestamp: Date}>): number {
    if (messages.length < 2) return 0
    
    let totalTime = 0
    let responseCount = 0
    
    for (let i = 1; i < messages.length; i++) {
      const timeDiff = messages[i].timestamp.getTime() - messages[i-1].timestamp.getTime()
      totalTime += timeDiff
      responseCount++
    }
    
    return responseCount > 0 ? Math.round(totalTime / responseCount / 1000) : 0 // Convert to seconds
  }
}

let conversationSummaryService: ConversationSummaryService | null = null

export async function getConversationSummaryService(): Promise<ConversationSummaryService> {
  if (!conversationSummaryService) {
    const { db } = await connectToDatabase()
    conversationSummaryService = new ConversationSummaryService(db)
  }
  return conversationSummaryService
}

// Convenience functions
export async function analyzeConversation(request: ConversationAnalysisRequest) {
  const service = await getConversationSummaryService()
  return service.analyzeConversation(request)
}

export async function getStudentConversationSummaries(userId: string, limit?: number) {
  const service = await getConversationSummaryService()
  return service.getStudentConversationSummaries(userId, limit)
}

export async function getStudentConversationInsights(userId: string) {
  const service = await getConversationSummaryService()
  return service.getStudentConversationInsights(userId)
}
