import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, executeWithRetry, COLLECTIONS } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '7d'
    const metric = searchParams.get('metric') || 'all'
    const groupBy = searchParams.get('groupBy') || 'day'

    // Calculate date range
    const now = new Date()
    let startDate: Date
    
    switch (timeframe) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    const insights = await executeWithRetry(async (db) => {
      const pipeline = []

      // Match analyses within timeframe
      pipeline.push({
        $match: {
          analysisDate: { $gte: startDate }
        }
      })

      // Group by specified field
      let groupField: any = {}
      switch (groupBy) {
        case 'day':
          groupField = {
            year: { $year: '$analysisDate' },
            month: { $month: '$analysisDate' },
            day: { $dayOfMonth: '$analysisDate' }
          }
          break
        case 'week':
          groupField = {
            year: { $year: '$analysisDate' },
            week: { $week: '$analysisDate' }
          }
          break
        case 'month':
          groupField = {
            year: { $year: '$analysisDate' },
            month: { $month: '$analysisDate' }
          }
          break
        default:
          groupField = {
            year: { $year: '$analysisDate' },
            month: { $month: '$analysisDate' },
            day: { $dayOfMonth: '$analysisDate' }
          }
      }

      // Aggregate based on metric
      let aggregationFields: any = {
        _id: groupField,
        totalAnalyses: { $sum: 1 },
        uniqueStudents: { $addToSet: '$studentId' }
      }

      switch (metric) {
        case 'challenges':
          aggregationFields = {
            ...aggregationFields,
            totalChallenges: { $sum: { $size: '$challengeSummary.primaryChallenges' } },
            highSeverityChallenges: {
              $sum: {
                $cond: [
                  { $eq: ['$challengeSummary.challengeSeverity', 'high'] },
                  1,
                  0
                ]
              }
            },
            interventionsNeeded: {
              $sum: {
                $cond: ['$challengeSummary.interventionNeeded', 1, 0]
              }
            }
          }
          break
        case 'performance':
          aggregationFields = {
            ...aggregationFields,
            averageGrade: { $avg: '$performanceSummary.averageGrade' },
            improvingTrend: {
              $sum: {
                $cond: [
                  { $eq: ['$performanceSummary.gradeTrend', 'improving'] },
                  1,
                  0
                ]
              }
            },
            decliningTrend: {
              $sum: {
                $cond: [
                  { $eq: ['$performanceSummary.gradeTrend', 'declining'] },
                  1,
                  0
                ]
              }
            }
          }
          break
        case 'engagement':
          aggregationFields = {
            ...aggregationFields,
            averageEngagement: { $avg: '$conversationSummary.totalInteractions' },
            highEngagement: {
              $sum: {
                $cond: [
                  { $eq: ['$conversationSummary.comprehensionLevel', 'high'] },
                  1,
                  0
                ]
              }
            },
            lowEngagement: {
              $sum: {
                $cond: [
                  { $eq: ['$conversationSummary.comprehensionLevel', 'low'] },
                  1,
                  0
                ]
              }
            }
          }
          break
        case 'scores':
          aggregationFields = {
            ...aggregationFields,
            scoreUpdates: {
              $sum: {
                $cond: [
                  { $ne: ['$knowledgeScoreUpdate.previousScore', '$knowledgeScoreUpdate.newScore'] },
                  1,
                  0
                ]
              }
            },
            highConfidenceUpdates: {
              $sum: {
                $cond: [
                  { $gte: ['$knowledgeScoreUpdate.confidenceLevel', 80] },
                  1,
                  0
                ]
              }
            },
            adminReviewRequired: {
              $sum: {
                $cond: ['$knowledgeScoreUpdate.adminReviewRequired', 1, 0]
              }
            }
          }
          break
      }

      pipeline.push({
        $group: aggregationFields
      })

      // Add computed fields
      pipeline.push({
        $addFields: {
          uniqueStudentCount: { $size: '$uniqueStudents' }
        }
      })

      // Sort by date
      pipeline.push({
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      })

      const results = await db.collection(COLLECTIONS.ANALYSIS_RESULTS)
        .aggregate(pipeline)
        .toArray()

      return results
    })

    // Get additional system-wide insights
    const systemInsights = await executeWithRetry(async (db) => {
      const [
        totalAnalyses,
        totalStudents,
        recentAnalyses,
        pendingReviews
      ] = await Promise.all([
        db.collection(COLLECTIONS.ANALYSIS_RESULTS).countDocuments(),
        db.collection(COLLECTIONS.STUDENT_PROFILES).countDocuments(),
        db.collection(COLLECTIONS.ANALYSIS_RESULTS)
          .countDocuments({ analysisDate: { $gte: startDate } }),
        db.collection(COLLECTIONS.ANALYSIS_RESULTS)
          .countDocuments({ 'knowledgeScoreUpdate.adminReviewRequired': true })
      ])

      return {
        totalAnalyses,
        totalStudents,
        recentAnalyses,
        pendingReviews,
        analysisRate: totalStudents > 0 ? (totalAnalyses / totalStudents) : 0
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        timeframe,
        metric,
        groupBy,
        insights,
        systemInsights,
        generatedAt: new Date().toISOString()
      },
      message: 'System insights retrieved successfully'
    })

  } catch (error) {
    console.error('Error fetching system insights:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch system insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
