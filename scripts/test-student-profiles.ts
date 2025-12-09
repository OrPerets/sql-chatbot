import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { StudentProfilesService } from '../lib/student-profiles'
import { ActivityTracker } from '../lib/activity-tracker'

async function testStudentProfilesSystem() {
  console.log('🧪 Testing Student Profiles System...')
  
  try {
    const { db } = await connectToDatabase()
    const studentProfilesService = new StudentProfilesService(db)
    const activityTracker = new ActivityTracker(db)

    // Test 1: Create a test student profile
    console.log('\n📝 Test 1: Creating test student profile...')
    const testUserId = 'test-user-' + Date.now()
    const profile = await studentProfilesService.createStudentProfile(testUserId)
    console.log('✅ Created profile:', profile._id)

    // Test 2: Update knowledge score
    console.log('\n📊 Test 2: Updating knowledge score...')
    const scoreUpdated = await studentProfilesService.updateKnowledgeScore(
      testUserId,
      'good',
      'Test score update',
      'admin'
    )
    console.log('✅ Score updated:', scoreUpdated)

    // Test 3: Track activities
    console.log('\n📈 Test 3: Tracking activities...')
    await activityTracker.trackChatActivity(
      testUserId,
      5,
      'SQL Basics',
      'intermediate',
      true,
      'session-123'
    )
    await activityTracker.trackHomeworkSubmission(
      testUserId,
      'homework-1',
      'question-1',
      85,
      1200,
      2,
      ['syntax error', 'missing semicolon'],
      'session-123'
    )
    await activityTracker.trackLoginActivity(
      testUserId,
      'email',
      1800,
      'session-123'
    )
    console.log('✅ Activities tracked')

    // Test 4: Get student profile
    console.log('\n👤 Test 4: Retrieving student profile...')
    const retrievedProfile = await studentProfilesService.getStudentProfile(testUserId)
    console.log('✅ Retrieved profile:', {
      knowledgeScore: retrievedProfile?.knowledgeScore,
      totalQuestions: retrievedProfile?.totalQuestions,
      chatSessions: retrievedProfile?.engagementMetrics.chatSessions
    })

    // Test 5: Get activity history
    console.log('\n📋 Test 5: Getting activity history...')
    const activities = await activityTracker.getStudentActivityHistory(testUserId, 10)
    console.log('✅ Retrieved activities:', activities.length)

    // Test 6: Get analytics
    console.log('\n📊 Test 6: Getting analytics...')
    const analytics = await studentProfilesService.getStudentAnalytics()
    console.log('✅ Analytics:', {
      totalStudents: analytics.totalStudents,
      averageGrade: analytics.averageGrade
    })

    // Test 7: Get all profiles with pagination
    console.log('\n📄 Test 7: Getting all profiles with pagination...')
    const profilesResult = await studentProfilesService.getAllStudentProfiles(1, 5)
    console.log('✅ Retrieved profiles:', {
      count: profilesResult.profiles.length,
      total: profilesResult.total,
      pages: profilesResult.totalPages
    })

    // Test 8: Update engagement metrics
    console.log('\n📈 Test 8: Updating engagement metrics...')
    const metricsUpdated = await studentProfilesService.updateEngagementMetrics(testUserId, {
      chatSessions: 10,
      averageSessionDuration: 25,
      helpRequests: 3,
      selfCorrections: 2
    })
    console.log('✅ Metrics updated:', metricsUpdated)

    // Test 9: Update learning progress
    console.log('\n🎯 Test 9: Updating learning progress...')
    const progressUpdated = await studentProfilesService.updateLearningProgress(testUserId, {
      sqlBasics: 80,
      joins: 60,
      aggregations: 40,
      subqueries: 20,
      advancedQueries: 10
    })
    console.log('✅ Progress updated:', progressUpdated)

    // Test 10: Update risk assessment
    console.log('\n⚠️  Test 10: Updating risk assessment...')
    const riskUpdated = await studentProfilesService.updateRiskAssessment(testUserId, {
      isAtRisk: false,
      riskLevel: 'low',
      riskFactors: ['needs more practice with joins'],
      lastAssessment: new Date()
    })
    console.log('✅ Risk assessment updated:', riskUpdated)

    // Test 11: Get activity statistics
    console.log('\n📊 Test 11: Getting activity statistics...')
    const stats = await activityTracker.getActivityStatistics(testUserId)
    console.log('✅ Activity statistics:', stats)

    // Test 12: Analyze engagement patterns
    console.log('\n🔍 Test 12: Analyzing engagement patterns...')
    const patterns = await activityTracker.analyzeEngagementPatterns(testUserId)
    console.log('✅ Engagement patterns:', patterns.length)

    // Cleanup: Remove test data
    console.log('\n🧹 Cleaning up test data...')
    await db.collection(COLLECTIONS.STUDENT_PROFILES).deleteOne({ userId: testUserId })
    await db.collection(COLLECTIONS.STUDENT_ACTIVITIES).deleteMany({ userId: testUserId })
    console.log('✅ Test data cleaned up')

    console.log('\n🎉 All tests passed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    throw error
  }
}

async function testDatabasePerformance() {
  console.log('\n⚡ Testing database performance...')
  
  try {
    const { db } = await connectToDatabase()
    const studentProfilesService = new StudentProfilesService(db)

    // Test with large dataset simulation
    const startTime = Date.now()
    
    // Get all profiles
    const profilesResult = await studentProfilesService.getAllStudentProfiles(1, 1000)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`✅ Performance test completed in ${duration}ms`)
    console.log(`📊 Retrieved ${profilesResult.profiles.length} profiles`)
    
    if (duration > 5000) {
      console.warn('⚠️  Performance warning: Query took longer than 5 seconds')
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
    await testStudentProfilesSystem()
    await testDatabasePerformance()
    console.log('\n🎯 All tests completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Test suite failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { testStudentProfilesSystem, testDatabasePerformance }
