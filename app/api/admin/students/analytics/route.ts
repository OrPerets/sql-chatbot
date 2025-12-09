import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const result = await executeWithRetry(async (db) => {
      // Get all student profiles
      const profiles = await db.collection(COLLECTIONS.STUDENT_PROFILES).find({}).toArray()
      
      // Calculate analytics
      const totalStudents = profiles.length
      
      // Score distribution
      const scoreDistribution = {
        empty: 0,
        good: 0,
        needs_attention: 0,
        struggling: 0
      }
      
      // Risk distribution
      const riskDistribution = {
        low: 0,
        medium: 0,
        high: 0
      }
      
      let totalGrade = 0
      let totalEngagement = 0
      let gradeCount = 0
      let engagementCount = 0
      const allChallenges: string[] = []
      
      profiles.forEach(profile => {
        // Count score distribution
        if (profile.knowledgeScore) {
          scoreDistribution[profile.knowledgeScore]++
        }
        
        // Count risk distribution
        if (profile.riskFactors?.riskLevel) {
          riskDistribution[profile.riskFactors.riskLevel]++
        }
        
        // Calculate averages
        if (profile.averageGrade && profile.averageGrade > 0) {
          totalGrade += profile.averageGrade
          gradeCount++
        }
        
        if (profile.engagementMetrics?.chatSessions) {
          totalEngagement += profile.engagementMetrics.chatSessions
          engagementCount++
        }
        
        // Collect challenges
        if (profile.commonChallenges && Array.isArray(profile.commonChallenges)) {
          allChallenges.push(...profile.commonChallenges)
        }
      })
      
      // Calculate top challenges
      const challengeCounts: Record<string, number> = {}
      allChallenges.forEach(challenge => {
        challengeCounts[challenge] = (challengeCounts[challenge] || 0) + 1
      })
      
      const topChallenges = Object.entries(challengeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([challenge]) => challenge)
      
      return {
        totalStudents,
        scoreDistribution,
        riskDistribution,
        averageGrade: gradeCount > 0 ? totalGrade / gradeCount : 0,
        averageEngagement: engagementCount > 0 ? totalEngagement / engagementCount : 0,
        topChallenges
      }
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error fetching student analytics:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch student analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}