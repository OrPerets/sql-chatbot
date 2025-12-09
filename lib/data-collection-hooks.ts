import { trackActivity, trackChatActivity, trackHomeworkSubmission, trackLoginActivity } from './activity-tracker'
import { checkAnalysisTriggers, analyzeStudent } from './ai-analysis-engine'

export interface ConversationMonitor {
  trackQuestions: (studentId: string, question: string, topic: string) => Promise<void>
  trackHelpRequests: (studentId: string, requestType: string) => Promise<void>
  trackComprehension: (studentId: string, indicators: string[]) => Promise<void>
}

export interface PerformanceTracker {
  trackHomeworkSubmission: (studentId: string, grade: number, errors: string[]) => Promise<void>
  trackErrorPatterns: (studentId: string, errorType: string, frequency: number) => Promise<void>
  trackTimeSpent: (studentId: string, topic: string, duration: number) => Promise<void>
}

export interface BehaviorAnalyzer {
  trackEngagement: (studentId: string, metrics: any) => Promise<void>
  trackFeedbackResponse: (studentId: string, response: any) => Promise<void>
  trackSelfInitiative: (studentId: string, actions: string[]) => Promise<void>
}

export class DataCollectionHooks {
  private analysisQueue: Map<string, NodeJS.Timeout> = new Map()
  private readonly ANALYSIS_DELAY = 5000 // 5 seconds delay before analysis

  /**
   * Conversation monitoring hooks
   */
  async trackQuestions(studentId: string, question: string, topic: string): Promise<void> {
    try {
      // Analyze question complexity
      const complexity = this.analyzeQuestionComplexity(question)
      const helpRequested = this.detectHelpRequest(question)
      
      await trackChatActivity(
        studentId,
        1, // messageCount
        topic,
        complexity,
        helpRequested
      )

      // Check if analysis should be triggered
      await this.scheduleAnalysisIfNeeded(studentId, 'conversation_activity')
    } catch (error) {
      console.error('Error tracking question:', error)
    }
  }

  async trackHelpRequests(studentId: string, requestType: string): Promise<void> {
    try {
      await trackActivity({
        userId: studentId,
        activityType: 'help_request',
        activityData: {
          helpType: requestType,
          urgency: this.determineUrgency(requestType),
          resolved: false
        }
      })

      await this.scheduleAnalysisIfNeeded(studentId, 'help_request')
    } catch (error) {
      console.error('Error tracking help request:', error)
    }
  }

  async trackComprehension(studentId: string, indicators: string[]): Promise<void> {
    try {
      await trackActivity({
        userId: studentId,
        activityType: 'chat',
        activityData: {
          topic: 'comprehension_assessment',
          metadata: {
            comprehensionIndicators: indicators
          }
        }
      })

      // If comprehension indicators suggest difficulty, trigger analysis
      if (indicators.some(indicator => 
        indicator.includes('confused') || 
        indicator.includes('not_understood') || 
        indicator.includes('need_clarification')
      )) {
        await this.scheduleAnalysisIfNeeded(studentId, 'comprehension_difficulty')
      }
    } catch (error) {
      console.error('Error tracking comprehension:', error)
    }
  }

  /**
   * Performance tracking hooks
   */
  async trackHomeworkSubmission(
    studentId: string, 
    homeworkId: string, 
    questionId: string, 
    grade: number, 
    timeSpent: number, 
    attempts: number, 
    errors: string[]
  ): Promise<void> {
    try {
      await trackHomeworkSubmission(
        studentId,
        homeworkId,
        questionId,
        grade,
        timeSpent,
        attempts,
        errors
      )

      // Check for performance triggers
      if (grade < 60 || errors.length > 3 || attempts > 5) {
        await this.scheduleAnalysisIfNeeded(studentId, 'poor_performance')
      }
    } catch (error) {
      console.error('Error tracking homework submission:', error)
    }
  }

  async trackErrorPatterns(studentId: string, errorType: string, frequency: number): Promise<void> {
    try {
      await trackActivity({
        userId: studentId,
        activityType: 'practice',
        activityData: {
          success: false,
          metadata: {
            errorType,
            frequency
          }
        }
      })

      // If error frequency is high, trigger analysis
      if (frequency >= 5) {
        await this.scheduleAnalysisIfNeeded(studentId, 'high_error_frequency')
      }
    } catch (error) {
      console.error('Error tracking error patterns:', error)
    }
  }

  async trackTimeSpent(studentId: string, topic: string, duration: number): Promise<void> {
    try {
      await trackActivity({
        userId: studentId,
        activityType: 'practice',
        activityData: {
          topic,
          metadata: {
            duration,
            timeEfficiency: this.calculateTimeEfficiency(duration, topic)
          }
        }
      })

      // If time spent is excessive, trigger analysis
      if (duration > 30) { // 30 minutes
        await this.scheduleAnalysisIfNeeded(studentId, 'excessive_time_spent')
      }
    } catch (error) {
      console.error('Error tracking time spent:', error)
    }
  }

  /**
   * Behavior analysis hooks
   */
  async trackEngagement(studentId: string, metrics: any): Promise<void> {
    try {
      await trackActivity({
        userId: studentId,
        activityType: 'chat',
        activityData: {
          metadata: {
            engagementMetrics: metrics,
            sessionQuality: this.assessSessionQuality(metrics)
          }
        }
      })

      // Check for engagement drop
      if (metrics.sessionDuration < 5 || metrics.messageCount < 3) {
        await this.scheduleAnalysisIfNeeded(studentId, 'low_engagement')
      }
    } catch (error) {
      console.error('Error tracking engagement:', error)
    }
  }

  async trackFeedbackResponse(studentId: string, response: any): Promise<void> {
    try {
      await trackActivity({
        userId: studentId,
        activityType: 'chat',
        activityData: {
          metadata: {
            feedbackResponse: response,
            acceptanceRate: this.calculateAcceptanceRate(response)
          }
        }
      })

      // If feedback acceptance is low, trigger analysis
      if (response.acceptanceRate < 0.3) {
        await this.scheduleAnalysisIfNeeded(studentId, 'low_feedback_acceptance')
      }
    } catch (error) {
      console.error('Error tracking feedback response:', error)
    }
  }

  async trackSelfInitiative(studentId: string, actions: string[]): Promise<void> {
    try {
      await trackActivity({
        userId: studentId,
        activityType: 'practice',
        activityData: {
          metadata: {
            selfInitiativeActions: actions,
            initiativeLevel: this.assessInitiativeLevel(actions)
          }
        }
      })

      // If self-initiative is low, trigger analysis
      if (actions.length === 0) {
        await this.scheduleAnalysisIfNeeded(studentId, 'low_self_initiative')
      }
    } catch (error) {
      console.error('Error tracking self initiative:', error)
    }
  }

  /**
   * Schedule analysis if needed with debouncing
   */
  private async scheduleAnalysisIfNeeded(studentId: string, reason: string): Promise<void> {
    // Clear existing timeout for this student
    const existingTimeout = this.analysisQueue.get(studentId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Schedule new analysis with delay
    const timeout = setTimeout(async () => {
      try {
        const shouldAnalyze = await checkAnalysisTriggers(studentId)
        if (shouldAnalyze.shouldAnalyze) {
          await analyzeStudent({
            studentId,
            analysisType: 'triggered',
            triggerReason: `${reason}: ${shouldAnalyze.reason}`
          })
        }
      } catch (error) {
        console.error('Error in scheduled analysis:', error)
      } finally {
        this.analysisQueue.delete(studentId)
      }
    }, this.ANALYSIS_DELAY)

    this.analysisQueue.set(studentId, timeout)
  }

  /**
   * Helper methods for analysis
   */
  private analyzeQuestionComplexity(question: string): 'basic' | 'intermediate' | 'advanced' {
    const basicKeywords = ['what', 'how', 'show', 'select', 'basic']
    const advancedKeywords = ['optimize', 'performance', 'index', 'join', 'subquery', 'complex']
    
    const lowerQuestion = question.toLowerCase()
    
    if (advancedKeywords.some(keyword => lowerQuestion.includes(keyword))) {
      return 'advanced'
    } else if (basicKeywords.some(keyword => lowerQuestion.includes(keyword))) {
      return 'basic'
    } else {
      return 'intermediate'
    }
  }

  private detectHelpRequest(question: string): boolean {
    const helpKeywords = ['help', 'explain', 'how to', 'tutorial', 'guide', 'step by step']
    const lowerQuestion = question.toLowerCase()
    return helpKeywords.some(keyword => lowerQuestion.includes(keyword))
  }

  private determineUrgency(requestType: string): 'low' | 'medium' | 'high' {
    const highUrgencyTypes = ['error', 'broken', 'urgent', 'deadline']
    const mediumUrgencyTypes = ['confused', 'stuck', 'difficult']
    
    const lowerType = requestType.toLowerCase()
    
    if (highUrgencyTypes.some(keyword => lowerType.includes(keyword))) {
      return 'high'
    } else if (mediumUrgencyTypes.some(keyword => lowerType.includes(keyword))) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  private calculateTimeEfficiency(duration: number, topic: string): number {
    // Simple time efficiency calculation
    const expectedTimes: Record<string, number> = {
      'basic_select': 5,
      'joins': 15,
      'aggregations': 20,
      'subqueries': 25,
      'advanced_queries': 30
    }
    
    const expectedTime = expectedTimes[topic] || 15
    const efficiency = Math.max(0, Math.min(100, (expectedTime / duration) * 100))
    return Math.round(efficiency)
  }

  private assessSessionQuality(metrics: any): string {
    if (metrics.sessionDuration > 20 && metrics.messageCount > 10) {
      return 'high_quality'
    } else if (metrics.sessionDuration > 10 && metrics.messageCount > 5) {
      return 'medium_quality'
    } else {
      return 'low_quality'
    }
  }

  private calculateAcceptanceRate(response: any): number {
    if (!response.accepted || !response.total) return 0
    return response.accepted / response.total
  }

  private assessInitiativeLevel(actions: string[]): string {
    const initiativeActions = ['self_correction', 'exploration', 'experimentation', 'research']
    const initiativeCount = actions.filter(action => 
      initiativeActions.some(initiative => action.includes(initiative))
    ).length
    
    if (initiativeCount >= 3) return 'high'
    if (initiativeCount >= 1) return 'medium'
    return 'low'
  }
}

let dataCollectionHooks: DataCollectionHooks | null = null

export async function getDataCollectionHooks(): Promise<DataCollectionHooks> {
  if (!dataCollectionHooks) {
    dataCollectionHooks = new DataCollectionHooks()
  }
  return dataCollectionHooks
}

// Convenience functions for easy integration
export async function trackStudentQuestion(studentId: string, question: string, topic: string) {
  const hooks = await getDataCollectionHooks()
  return hooks.trackQuestions(studentId, question, topic)
}

export async function trackStudentHelpRequest(studentId: string, requestType: string) {
  const hooks = await getDataCollectionHooks()
  return hooks.trackHelpRequests(studentId, requestType)
}

export async function trackStudentComprehension(studentId: string, indicators: string[]) {
  const hooks = await getDataCollectionHooks()
  return hooks.trackComprehension(studentId, indicators)
}

export async function trackStudentPerformance(
  studentId: string, 
  homeworkId: string, 
  questionId: string, 
  grade: number, 
  timeSpent: number, 
  attempts: number, 
  errors: string[]
) {
  const hooks = await getDataCollectionHooks()
  return hooks.trackHomeworkSubmission(studentId, homeworkId, questionId, grade, timeSpent, attempts, errors)
}

export async function trackStudentEngagement(studentId: string, metrics: any) {
  const hooks = await getDataCollectionHooks()
  return hooks.trackEngagement(studentId, metrics)
}
