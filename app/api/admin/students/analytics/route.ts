import { NextRequest, NextResponse } from 'next/server'
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth'
import { parseAcademicPeriodFromSearchParams } from '@/lib/academic-period'
import {
  buildAdminStudentProfileSummaries,
  buildProfileScopeQuery,
  getScopedStudentUsers,
} from '@/lib/admin-student-profile-summary'
import { executeWithRetry, COLLECTIONS } from '@/lib/database'
import type { StudentProfile } from '@/lib/student-profiles'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const academicPeriod = parseAcademicPeriodFromSearchParams(searchParams)
    const result = await executeWithRetry(async (db) => {
      const profileQuery: any = {}
      let scopedUsers = undefined
      if (academicPeriod) {
        scopedUsers = await getScopedStudentUsers(db, academicPeriod)
        if (scopedUsers.length === 0) {
          return {
            totalStudents: 0,
            scoreDistribution: { empty: 0, good: 0, needs_attention: 0, struggling: 0 },
            riskDistribution: { low: 0, medium: 0, high: 0 },
            averageGrade: 0,
            averageEngagement: 0,
            topChallenges: [],
            freshnessDistribution: { current: 0, stale: 0, needs_recalculation: 0, no_evidence: 0 },
            needsReview: 0,
            missingSubmissions: 0,
            lowActivity: 0,
            staleProfiles: 0,
            noEvidence: 0,
            averageHomeworkCompletion: 0,
          }
        }
        profileQuery.$or = buildProfileScopeQuery(scopedUsers).$or
      }

      // Get all student profiles
      const profiles = await db.collection<StudentProfile>(COLLECTIONS.STUDENT_PROFILES).find(profileQuery).limit(1000).toArray()
      const summaries = await buildAdminStudentProfileSummaries(db, profiles, {
        academicPeriod,
        scopedUsers,
      })
      
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
      const freshnessDistribution = {
        current: 0,
        stale: 0,
        needs_recalculation: 0,
        no_evidence: 0,
      }
      let needsReview = 0
      let missingSubmissions = 0
      let lowActivity = 0
      let staleProfiles = 0
      let noEvidence = 0
      let completionSum = 0
      let completionCount = 0
      
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

        const summary = summaries.get(String(profile._id?.toString?.() || profile.userId))
        if (summary) {
          freshnessDistribution[summary.freshnessStatus] += 1
          if (summary.flags.needsReview) needsReview += 1
          if (summary.flags.missingSubmissions) missingSubmissions += 1
          if (summary.flags.lowActivity) lowActivity += 1
          if (summary.flags.staleProfile) staleProfiles += 1
          if (summary.flags.noEvidence) noEvidence += 1
          if (summary.homeworkCompletion.total > 0) {
            completionSum += summary.homeworkCompletion.completed / summary.homeworkCompletion.total
            completionCount += 1
          }
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
        topChallenges,
        freshnessDistribution,
        needsReview,
        missingSubmissions,
        lowActivity,
        staleProfiles,
        noEvidence,
        averageHomeworkCompletion: completionCount > 0 ? completionSum / completionCount : 0,
      }
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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
