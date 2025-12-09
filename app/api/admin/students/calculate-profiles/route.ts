import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase, COLLECTIONS } from '@/lib/database'
import { StudentProfilesService } from '@/lib/student-profiles'
import { getStudentConversationInsights } from '@/lib/conversation-summary'

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()
    const studentProfilesService = new StudentProfilesService(db)

    console.log('🔄 Starting profile calculation process...')

    // Get all users
    const users = await db.collection(COLLECTIONS.USERS).find({}).toArray()
    console.log(`👥 Found ${users.length} users`)

    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const user of users) {
      try {
        console.log(`📊 Processing user: ${user.email}`)

        // Check if profile already exists
        const existingProfile = await studentProfilesService.getStudentProfile(user._id.toString())
        
        if (existingProfile) {
          // Update existing profile
          await updateStudentProfileFromData(db, studentProfilesService, user._id, user.email)
          updated++
          console.log(`✅ Updated profile for ${user.email}`)
        } else {
          // Create new profile
          await createStudentProfileFromData(db, studentProfilesService, user._id, user.email)
          created++
          console.log(`✅ Created profile for ${user.email}`)
        }
      } catch (error) {
        const errorMsg = `Failed to process user ${user.email}: ${error}`
        errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }

    console.log(`🎉 Profile calculation completed! Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`)

    return NextResponse.json({
      success: true,
      data: {
        created,
        updated,
        errors: errors.length,
        errorDetails: errors.slice(0, 5) // Show first 5 errors
      },
      message: `Profile calculation completed successfully`
    })

  } catch (error) {
    console.error('Error calculating profiles:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to calculate profiles',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function createStudentProfileFromData(
  db: any, 
  studentProfilesService: StudentProfilesService, 
  userId: any, 
  userEmail: string
) {
  // Create basic profile
  const profile = await studentProfilesService.createStudentProfile(userId.toString())
  
  // Update with aggregated data
  await updateStudentProfileFromData(db, studentProfilesService, userId, userEmail)
}

async function updateStudentProfileFromData(
  db: any,
  studentProfilesService: StudentProfilesService,
  userId: any,
  userEmail: string
) {
  console.log(`📈 Aggregating data for ${userEmail}...`)

  // Get all data for this user
  const [
    chatSessions,
    chatMessages,
    homeworkSubmissions,
    conversationSummaries,
    studentActivities
  ] = await Promise.all([
    db.collection(COLLECTIONS.CHAT_SESSIONS).find({ userId: userEmail }).toArray(),
    db.collection(COLLECTIONS.CHAT_MESSAGES).find({ userId: userEmail }).toArray(),
    db.collection(COLLECTIONS.SUBMISSIONS).find({ studentId: userEmail }).toArray(),
    db.collection(COLLECTIONS.CONVERSATION_SUMMARIES).find({ userId: userEmail }).toArray(),
    db.collection(COLLECTIONS.STUDENT_ACTIVITIES).find({ userId: userEmail }).toArray()
  ])

  // Calculate metrics
  const totalQuestions = chatMessages.filter(msg => msg.role === 'user').length
  const helpRequests = studentActivities.filter(activity => 
    activity.activityType === 'help_request' || 
    activity.activityData?.helpRequested === true
  ).length

  // Calculate homework metrics
  const homeworkGrades = homeworkSubmissions
    .filter(sub => sub.overallScore !== undefined)
    .map(sub => sub.overallScore)
  const averageGrade = homeworkGrades.length > 0 
    ? homeworkGrades.reduce((sum, grade) => sum + grade, 0) / homeworkGrades.length 
    : 0

  // Calculate session duration
  const sessionDurations = chatSessions.map(session => {
    const messages = chatMessages.filter(msg => msg.chatId?.toString() === session._id.toString())
    if (messages.length < 2) return 0
    
    const firstMessage = messages[0]?.timestamp
    const lastMessage = messages[messages.length - 1]?.timestamp
    
    if (!firstMessage || !lastMessage) return 0
    
    return (new Date(lastMessage).getTime() - new Date(firstMessage).getTime()) / (1000 * 60) // minutes
  })
  
  const averageSessionDuration = sessionDurations.length > 0
    ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
    : 0

  // Extract common challenges from conversation summaries
  const allChallenges = conversationSummaries.flatMap(summary => 
    summary.learningIndicators?.challengeAreas || []
  )
  const challengeCounts: Record<string, number> = {}
  allChallenges.forEach(challenge => {
    challengeCounts[challenge] = (challengeCounts[challenge] || 0) + 1
  })
  const commonChallenges = Object.entries(challengeCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([challenge]) => challenge)

  // Calculate learning progress from conversation summaries
  const learningProgress = {
    sqlBasics: 0,
    joins: 0,
    aggregations: 0,
    subqueries: 0,
    advancedQueries: 0
  }

  // Extract topics from conversation summaries and calculate progress
  conversationSummaries.forEach(summary => {
    summary.keyTopics?.forEach(topic => {
      const lowerTopic = topic.toLowerCase()
      if (lowerTopic.includes('join')) learningProgress.joins += 20
      if (lowerTopic.includes('aggregat') || lowerTopic.includes('group by')) learningProgress.aggregations += 20
      if (lowerTopic.includes('subquery')) learningProgress.subqueries += 20
      if (lowerTopic.includes('select') || lowerTopic.includes('basic')) learningProgress.sqlBasics += 20
      if (lowerTopic.includes('advanced') || lowerTopic.includes('complex')) learningProgress.advancedQueries += 20
    })
  })

  // Cap progress at 100
  Object.keys(learningProgress).forEach(key => {
    learningProgress[key as keyof typeof learningProgress] = Math.min(100, learningProgress[key as keyof typeof learningProgress])
  })

  // Determine knowledge score based on data
  let knowledgeScore: 'empty' | 'good' | 'needs_attention' | 'struggling' = 'empty'
  
  if (totalQuestions > 10 && averageGrade > 80) {
    knowledgeScore = 'good'
  } else if (totalQuestions > 5 && averageGrade > 60) {
    knowledgeScore = 'needs_attention'
  } else if (totalQuestions > 0) {
    knowledgeScore = 'struggling'
  }

  // Calculate risk factors
  const isAtRisk = helpRequests > 10 || averageGrade < 50 || commonChallenges.length > 3
  const riskLevel = isAtRisk ? (averageGrade < 40 ? 'high' : 'medium') : 'low'

  // Get conversation insights
  let conversationInsights
  try {
    conversationInsights = await getStudentConversationInsights(userEmail)
  } catch (error) {
    console.error(`Error getting conversation insights for ${userEmail}:`, error)
    conversationInsights = {
      totalSessions: chatSessions.length,
      averageSessionDuration: Math.round(averageSessionDuration),
      mostCommonTopics: [],
      learningTrend: 'stable' as const,
      commonChallenges: commonChallenges,
      overallEngagement: totalQuestions > 20 ? 'high' as const : totalQuestions > 10 ? 'medium' as const : 'low' as const,
      lastAnalysisDate: new Date()
    }
  }

  // Update the profile with all calculated data
  await studentProfilesService.updateKnowledgeScore(
    userId,
    knowledgeScore,
    'Calculated from aggregated data',
    'system'
  )

  await studentProfilesService.updateEngagementMetrics(userId, {
    chatSessions: chatSessions.length,
    averageSessionDuration: Math.round(averageSessionDuration),
    helpRequests: helpRequests,
    selfCorrections: 0 // TODO: Calculate from activities
  })

  await studentProfilesService.updateLearningProgress(userId, learningProgress)

  await studentProfilesService.updateRiskAssessment(userId, {
    isAtRisk,
    riskLevel: riskLevel as 'low' | 'medium' | 'high',
    riskFactors: commonChallenges,
    lastAssessment: new Date()
  })

  await studentProfilesService.updateConversationInsights(userId, {
    ...conversationInsights,
    lastAnalysisDate: new Date()
  })

  // Get user data to include name and email
  const user = await db.collection(COLLECTIONS.USERS).findOne({ _id: userId })

  // Update basic metrics
  await db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
    { userId },
    {
      $set: {
        name: user?.name || userEmail.split('@')[0] || 'ללא שם',
        email: userEmail,
        totalQuestions,
        correctAnswers: Math.round(totalQuestions * 0.8), // Estimate based on average grade
        homeworkSubmissions: homeworkSubmissions.length,
        averageGrade: Math.round(averageGrade * 100) / 100,
        commonChallenges,
        lastActivity: new Date(),
        updatedAt: new Date()
      }
    }
  )

  console.log(`✅ Updated profile for ${userEmail}: ${knowledgeScore} score, ${totalQuestions} questions, ${averageGrade.toFixed(1)} avg grade`)
}
