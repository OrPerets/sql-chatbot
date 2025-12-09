import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const result = await executeWithRetry(async (db) => {
      // Get all users from the users collection
      const users = await db.collection(COLLECTIONS.USERS).find({}).toArray()
      
      let migrated = 0
      let errors = 0
      
      for (const user of users) {
        try {
          // Check if profile already exists
          const existingProfile = await db.collection(COLLECTIONS.STUDENT_PROFILES)
            .findOne({ userId: user._id })
          
          if (!existingProfile) {
            // Create new student profile
            const studentProfile = {
              userId: user._id,
              name: user.name || '',
              email: user.email || '',
              knowledgeScore: 'empty' as const,
              knowledgeScoreHistory: [],
              lastActivity: new Date().toISOString(),
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
                riskLevel: 'low' as const,
                riskFactors: [],
                lastAssessment: new Date().toISOString()
              },
              conversationInsights: {
                totalSessions: 0,
                averageSessionDuration: 0,
                mostCommonTopics: [],
                learningTrend: 'stable' as const,
                commonChallenges: [],
                overallEngagement: 'low' as const,
                lastAnalysisDate: new Date().toISOString()
              },
              // Initialize new issue tracking fields
              issueCount: 0,
              issueHistory: [],
              lastIssueUpdate: new Date().toISOString(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
            
            await db.collection(COLLECTIONS.STUDENT_PROFILES).insertOne(studentProfile)
            migrated++
          }
        } catch (error) {
          console.error(`Error migrating user ${user._id}:`, error)
          errors++
        }
      }
      
      return {
        migrated,
        errors,
        totalUsers: users.length
      }
    })

    return NextResponse.json({
      success: true,
      data: result,
      message: `Migration completed: ${result.migrated} users migrated, ${result.errors} errors`
    })

  } catch (error) {
    console.error('Error migrating student profiles:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to migrate student profiles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}