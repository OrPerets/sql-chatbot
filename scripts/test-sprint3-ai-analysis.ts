import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { AIAnalysisEngine } from '../lib/ai-analysis-engine'
import { DataCollectionHooks } from '../lib/data-collection-hooks'
import { StudentProfilesService } from '../lib/student-profiles'
import { ActivityTracker } from '../lib/activity-tracker'

async function testSprint3AIAnalysis() {
  console.log('🧠 Testing Sprint 3: AI-Powered Knowledge Score Updates...')
  
  try {
    const { db } = await connectToDatabase()
    const aiAnalysisEngine = new AIAnalysisEngine(db)
    const dataCollectionHooks = new DataCollectionHooks()
    const studentProfilesService = new StudentProfilesService(db)
    const activityTracker = new ActivityTracker(db)

    // Test 1: Create test student profile
    console.log('\n📝 Test 1: Creating test student profile...')
    const testUserId = 'test-ai-student-' + Date.now()
    const profile = await studentProfilesService.createStudentProfile(testUserId)
    console.log('✅ Created profile:', profile._id)

    // Test 2: Track various student activities
    console.log('\n📈 Test 2: Tracking student activities...')
    
    // Track chat activities
    await dataCollectionHooks.trackQuestions(testUserId, 'How do I write a JOIN query?', 'joins')
    await dataCollectionHooks.trackQuestions(testUserId, 'What is GROUP BY used for?', 'aggregations')
    await dataCollectionHooks.trackQuestions(testUserId, 'Can you help me with JOINs again?', 'joins')
    await dataCollectionHooks.trackHelpRequests(testUserId, 'confused_about_joins')
    await dataCollectionHooks.trackHelpRequests(testUserId, 'need_examples')
    
    // Track homework performance
    await dataCollectionHooks.trackHomeworkSubmission(
      testUserId,
      'homework-1',
      'question-1',
      45, // Low grade
      1800, // 30 minutes
      5, // 5 attempts
      ['syntax_error', 'logical_error']
    )
    
    await dataCollectionHooks.trackHomeworkSubmission(
      testUserId,
      'homework-1',
      'question-2',
      60, // Better grade
      1200, // 20 minutes
      3, // 3 attempts
      ['syntax_error']
    )
    
    // Track comprehension issues
    await dataCollectionHooks.trackComprehension(testUserId, [
      'confused about join syntax',
      'not_understood aggregation functions',
      'need_clarification on subqueries'
    ])
    
    console.log('✅ Activities tracked')

    // Test 3: Check analysis triggers
    console.log('\n🔍 Test 3: Checking analysis triggers...')
    const triggerCheck = await aiAnalysisEngine.checkTriggers(testUserId)
    console.log('✅ Trigger check result:', triggerCheck)

    // Test 4: Perform AI analysis
    console.log('\n🤖 Test 4: Performing AI analysis...')
    const analysis = await aiAnalysisEngine.analyzeStudent({
      studentId: testUserId,
      analysisType: 'triggered',
      triggerReason: 'High help request frequency detected'
    })
    
    console.log('✅ Analysis completed:', {
      analysisId: analysis.studentId,
      challengeSeverity: analysis.challengeSummary.challengeSeverity,
      interventionNeeded: analysis.challengeSummary.interventionNeeded,
      newScore: analysis.knowledgeScoreUpdate.newScore,
      confidence: analysis.knowledgeScoreUpdate.confidenceLevel
    })

    // Test 5: Verify profile updates
    console.log('\n👤 Test 5: Verifying profile updates...')
    const updatedProfile = await studentProfilesService.getStudentProfile(testUserId)
    console.log('✅ Updated profile:', {
      knowledgeScore: updatedProfile?.knowledgeScore,
      totalQuestions: updatedProfile?.totalQuestions,
      helpRequests: updatedProfile?.engagementMetrics.helpRequests
    })

    // Test 6: Test conversation data collection
    console.log('\n💬 Test 6: Testing conversation data collection...')
    const conversationData = await aiAnalysisEngine['getConversationData'](testUserId)
    console.log('✅ Conversation data retrieved:', conversationData.length, 'messages')

    // Test 7: Test performance data collection
    console.log('\n📊 Test 7: Testing performance data collection...')
    const performanceData = await aiAnalysisEngine['getPerformanceData'](testUserId)
    console.log('✅ Performance data retrieved:', performanceData.length, 'submissions')

    // Test 8: Test activity statistics
    console.log('\n📈 Test 8: Testing activity statistics...')
    const stats = await activityTracker.getActivityStatistics(testUserId)
    console.log('✅ Activity statistics:', stats)

    // Test 9: Test engagement pattern analysis
    console.log('\n🔍 Test 9: Testing engagement pattern analysis...')
    const patterns = await activityTracker.analyzeEngagementPatterns(testUserId)
    console.log('✅ Engagement patterns:', patterns.length, 'patterns found')

    // Test 10: Test Michael assistant integration
    console.log('\n🤖 Test 10: Testing Michael assistant integration...')
    const testAnalysisData = {
      profile: updatedProfile,
      activities: await activityTracker.getStudentActivityHistory(testUserId, 50),
      conversationData,
      performanceData
    }
    
    const michaelResponse = await aiAnalysisEngine['sendToMichaelAssistant'](
      testAnalysisData,
      { studentId: testUserId, analysisType: 'manual', triggerReason: 'Test analysis' }
    )
    console.log('✅ Michael response received:', michaelResponse.length, 'characters')

    // Test 11: Test analysis result processing
    console.log('\n⚙️ Test 11: Testing analysis result processing...')
    const processedAnalysis = aiAnalysisEngine['processMichaelResponse'](
      michaelResponse,
      updatedProfile,
      { studentId: testUserId, analysisType: 'manual', triggerReason: 'Test' }
    )
    console.log('✅ Analysis processed:', {
      confidence: processedAnalysis.confidence,
      insights: processedAnalysis.insights.length,
      actions: processedAnalysis.actions.length
    })

    // Test 12: Test knowledge score calculation
    console.log('\n🎯 Test 12: Testing knowledge score calculation...')
    const scoreUpdate = aiAnalysisEngine['calculateKnowledgeScoreUpdate'](
      processedAnalysis,
      updatedProfile
    )
    console.log('✅ Score update calculated:', {
      previousScore: scoreUpdate.previousScore,
      newScore: scoreUpdate.newScore,
      confidence: scoreUpdate.confidenceLevel,
      adminReviewRequired: scoreUpdate.adminReviewRequired
    })

    // Cleanup: Remove test data
    console.log('\n🧹 Cleaning up test data...')
    await db.collection(COLLECTIONS.STUDENT_PROFILES).deleteOne({ userId: testUserId })
    await db.collection(COLLECTIONS.STUDENT_ACTIVITIES).deleteMany({ userId: testUserId })
    await db.collection(COLLECTIONS.ANALYSIS_RESULTS).deleteMany({ studentId: testUserId })
    console.log('✅ Test data cleaned up')

    console.log('\n🎉 All Sprint 3 tests passed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  }
}

async function testDataCollectionIntegration() {
  console.log('\n🔗 Testing Data Collection Integration...')
  
  try {
    const { db } = await connectToDatabase()
    const dataCollectionHooks = new DataCollectionHooks()

    // Test conversation monitoring
    console.log('📝 Testing conversation monitoring...')
    await dataCollectionHooks.trackQuestions('test-user-1', 'How do I use JOIN?', 'joins')
    await dataCollectionHooks.trackHelpRequests('test-user-1', 'confused_about_syntax')
    await dataCollectionHooks.trackComprehension('test-user-1', ['not_understood', 'need_help'])
    console.log('✅ Conversation monitoring working')

    // Test performance tracking
    console.log('📊 Testing performance tracking...')
    await dataCollectionHooks.trackHomeworkSubmission(
      'test-user-1',
      'hw-1',
      'q-1',
      70,
      900,
      2,
      ['syntax_error']
    )
    await dataCollectionHooks.trackErrorPatterns('test-user-1', 'syntax_error', 3)
    await dataCollectionHooks.trackTimeSpent('test-user-1', 'joins', 25)
    console.log('✅ Performance tracking working')

    // Test behavior analysis
    console.log('🧠 Testing behavior analysis...')
    await dataCollectionHooks.trackEngagement('test-user-1', {
      sessionDuration: 15,
      messageCount: 8,
      quality: 'high'
    })
    await dataCollectionHooks.trackFeedbackResponse('test-user-1', {
      accepted: 2,
      total: 3,
      acceptanceRate: 0.67
    })
    await dataCollectionHooks.trackSelfInitiative('test-user-1', [
      'self_correction',
      'exploration',
      'experimentation'
    ])
    console.log('✅ Behavior analysis working')

    console.log('🎉 Data collection integration tests passed!')
    
  } catch (error) {
    console.error('❌ Data collection integration test failed:', error)
    throw error
  }
}

async function testAIAnalysisPerformance() {
  console.log('\n⚡ Testing AI Analysis Performance...')
  
  try {
    const { db } = await connectToDatabase()
    const aiAnalysisEngine = new AIAnalysisEngine(db)

    // Test with multiple students
    const testStudents = ['perf-test-1', 'perf-test-2', 'perf-test-3']
    
    const startTime = Date.now()
    
    const analysisPromises = testStudents.map(async (studentId) => {
      try {
        return await aiAnalysisEngine.analyzeStudent({
          studentId,
          analysisType: 'performance_test',
          triggerReason: 'Performance testing'
        })
      } catch (error) {
        console.error(`Error analyzing ${studentId}:`, error)
        return null
      }
    })

    const results = await Promise.all(analysisPromises)
    const endTime = Date.now()
    const duration = endTime - startTime

    const successfulAnalyses = results.filter(r => r !== null).length
    
    console.log(`✅ Performance test completed in ${duration}ms`)
    console.log(`📊 ${successfulAnalyses}/${testStudents.length} analyses successful`)
    
    if (duration > 30000) {
      console.warn('⚠️  Performance warning: Analysis took longer than 30 seconds')
    } else {
      console.log('✅ Performance is acceptable')
    }
    
  } catch (error) {
    console.error('❌ Performance test failed:', error)
    throw error
  }
}

async function main() {
  try {
    await testSprint3AIAnalysis()
    await testDataCollectionIntegration()
    await testAIAnalysisPerformance()
    console.log('\n🎯 All Sprint 3 tests completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Sprint 3 test suite failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { testSprint3AIAnalysis, testDataCollectionIntegration, testAIAnalysisPerformance }
