import { connectToDatabase } from '../lib/database'
import { analyzeConversation } from '../lib/conversation-summary'

async function testAutomaticAnalysis() {
  console.log('🧪 Testing Automatic Conversation Analysis...')
  
  try {
    // Test with a real session ID from the database
    const { db } = await connectToDatabase()
    
    // Get a recent chat session
    const recentSession = await db.collection('chatSessions')
      .findOne({}, { sort: { lastMessageTimestamp: -1 } })
    
    if (!recentSession) {
      console.log('❌ No chat sessions found in database')
      return
    }

    console.log(`📝 Found session: ${recentSession._id}`)
    console.log(`👤 User: ${recentSession.userId}`)
    console.log(`📅 Created: ${recentSession.createdAt}`)

    // Get messages for this session
    const messages = await db.collection('chatMessages')
      .find({ chatId: recentSession._id })
      .sort({ timestamp: 1 })
      .toArray()

    console.log(`💬 Messages in session: ${messages.length}`)

    if (messages.length === 0) {
      console.log('❌ No messages found for this session')
      return
    }

    // Calculate session duration
    const sessionDuration = messages.length > 1 
      ? Math.round((messages[messages.length - 1].timestamp.getTime() - messages[0].timestamp.getTime()) / (1000 * 60))
      : 0

    console.log(`⏱️ Session duration: ${sessionDuration} minutes`)

    // Test the analysis
    const analysisRequest = {
      userId: recentSession.userId,
      sessionId: recentSession._id.toString(),
      sessionTitle: recentSession.title,
      messages: messages.map((msg: any) => ({
        role: (msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'user') as 'user' | 'assistant',
        text: msg.text,
        timestamp: msg.timestamp
      })),
      sessionDuration
    }

    console.log('\n🔍 Analyzing conversation...')
    const summary = await analyzeConversation(analysisRequest)
    
    console.log('✅ Analysis completed!')
    console.log('\n📊 Summary Points:')
    summary.summaryPoints.forEach((point, index) => {
      console.log(`  ${index + 1}. ${point}`)
    })
    
    console.log('\n🎯 Key Topics:')
    summary.keyTopics.forEach(topic => {
      console.log(`  • ${topic}`)
    })
    
    console.log('\n📈 Learning Indicators:')
    console.log(`  • Comprehension Level: ${summary.learningIndicators.comprehensionLevel}`)
    console.log(`  • Help Seeking Behavior: ${summary.learningIndicators.helpSeekingBehavior}`)
    console.log(`  • Engagement Level: ${summary.learningIndicators.engagementLevel}`)
    
    if (summary.learningIndicators.challengeAreas.length > 0) {
      console.log(`  • Challenge Areas: ${summary.learningIndicators.challengeAreas.join(', ')}`)
    }
    
    console.log('\n✅ Automatic analysis test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testAutomaticAnalysis()
  .then(() => {
    console.log('\n🎉 Automatic Conversation Analysis test completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test failed with error:', error)
    process.exit(1)
  })
