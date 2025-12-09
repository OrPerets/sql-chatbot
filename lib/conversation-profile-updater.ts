import { getStudentProfilesService } from './student-profiles'
import { getStudentConversationInsights } from './conversation-summary'
import { getAIAnalysisEngine } from './ai-analysis-engine'

/**
 * Service to automatically update student profiles with conversation insights
 */
export class ConversationProfileUpdater {
  
  /**
   * Update student profile with latest conversation insights
   */
  async updateStudentProfileFromConversations(userId: string): Promise<boolean> {
    try {
      const studentProfilesService = await getStudentProfilesService()
      
      // Get latest conversation insights
      const insights = await getStudentConversationInsights(userId)
      
      // Update student profile with conversation insights
      const updated = await studentProfilesService.updateConversationInsights(userId, {
        ...insights,
        lastAnalysisDate: new Date()
      })

      // Trigger issue analysis if profile was updated
      if (updated) {
        await this.triggerIssueAnalysisIfNeeded(userId)
      }
      
      return updated
    } catch (error) {
      console.error('Error updating student profile from conversations:', error)
      return false
    }
  }

  /**
   * Update multiple student profiles in batch
   */
  async updateMultipleStudentProfiles(userIds: string[]): Promise<{
    successful: number
    failed: number
    errors: string[]
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const userId of userIds) {
      try {
        const success = await this.updateStudentProfileFromConversations(userId)
        if (success) {
          results.successful++
        } else {
          results.failed++
          results.errors.push(`Failed to update profile for user ${userId}`)
        }
      } catch (error) {
        results.failed++
        results.errors.push(`Error updating profile for user ${userId}: ${error}`)
      }
    }

    return results
  }

  /**
   * Trigger issue analysis if conditions are met
   */
  private async triggerIssueAnalysisIfNeeded(userId: string): Promise<void> {
    try {
      const aiEngine = await getAIAnalysisEngine()
      
      // Check if analysis should be triggered
      const triggerResult = await aiEngine.checkTriggers(userId)
      
      if (triggerResult.shouldAnalyze) {
        console.log(`Triggering issue analysis for user ${userId}: ${triggerResult.reason}`)
        
        // Perform analysis
        await aiEngine.analyzeStudent({
          studentId: userId,
          analysisType: 'triggered',
          triggerReason: triggerResult.reason
        })
      }
    } catch (error) {
      console.error('Error triggering issue analysis:', error)
      // Don't throw error to avoid breaking the main flow
    }
  }
}

let conversationProfileUpdater: ConversationProfileUpdater | null = null

export async function getConversationProfileUpdater(): Promise<ConversationProfileUpdater> {
  if (!conversationProfileUpdater) {
    conversationProfileUpdater = new ConversationProfileUpdater()
  }
  return conversationProfileUpdater
}

// Convenience functions
export async function updateStudentProfileFromConversations(userId: string) {
  const updater = await getConversationProfileUpdater()
  return updater.updateStudentProfileFromConversations(userId)
}

export async function updateMultipleStudentProfiles(userIds: string[]) {
  const updater = await getConversationProfileUpdater()
  return updater.updateMultipleStudentProfiles(userIds)
}
