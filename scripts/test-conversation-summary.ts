import { connectToDatabase } from '../lib/database'
import { analyzeConversation } from '../lib/conversation-summary'

async function testConversationSummary() {
  console.log('🧪 Testing Conversation Summary System...')
  
  try {
    // Test conversation analysis
    const testRequest = {
      userId: 'test-user-123',
      sessionId: 'test-session-456',
      sessionTitle: 'SQL JOINs Help Session',
      messages: [
        {
          role: 'user' as const,
          text: 'I need help with JOINs in SQL. I keep getting errors.',
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        {
          role: 'assistant' as const,
          text: 'I\'d be happy to help you with JOINs! Can you show me the specific query you\'re working on?',
          timestamp: new Date('2024-01-15T10:01:00Z')
        },
        {
          role: 'user' as const,
          text: 'SELECT * FROM users JOIN orders ON users.id = orders.user_id',
          timestamp: new Date('2024-01-15T10:02:00Z')
        },
        {
          role: 'assistant' as const,
          text: 'That looks like a correct INNER JOIN syntax. What error are you getting?',
          timestamp: new Date('2024-01-15T10:03:00Z')
        },
        {
          role: 'user' as const,
          text: 'It says "Column \'id\' in field list is ambiguous". What does that mean?',
          timestamp: new Date('2024-01-15T10:04:00Z')
        },
        {
          role: 'assistant' as const,
          text: 'That error means both tables have an "id" column and the database doesn\'t know which one you want. You need to specify the table name: SELECT users.id, users.name, orders.id, orders.total FROM users JOIN orders ON users.id = orders.user_id',
          timestamp: new Date('2024-01-15T10:05:00Z')
        },
        {
          role: 'user' as const,
          text: 'Oh I see! Thank you, that makes sense. Can you also explain the difference between INNER JOIN and LEFT JOIN?',
          timestamp: new Date('2024-01-15T10:06:00Z')
        },
        {
          role: 'assistant' as const,
          text: 'Great question! INNER JOIN only returns rows where there\'s a match in both tables. LEFT JOIN returns all rows from the left table, even if there\'s no match in the right table. Would you like me to show you examples?',
          timestamp: new Date('2024-01-15T10:07:00Z')
        }
      ],
      sessionDuration: 7 // 7 minutes
    }

    console.log('\n📝 Analyzing test conversation...')
    const summary = await analyzeConversation(testRequest)
    
    console.log('✅ Conversation analysis completed!')
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
    console.log(`  • Challenge Areas: ${summary.learningIndicators.challengeAreas.join(', ')}`)
    
    console.log('\n🔍 Conversation Metadata:')
    console.log(`  • Message Count: ${summary.conversationMetadata.messageCount}`)
    console.log(`  • Session Duration: ${summary.conversationMetadata.sessionDuration} minutes`)
    console.log(`  • Complexity Level: ${summary.conversationMetadata.complexityLevel}`)
    console.log(`  • Average Response Time: ${summary.conversationMetadata.averageResponseTime} seconds`)
    
    console.log('\n🤖 AI Insights:')
    console.log(`  • Confidence Score: ${summary.aiInsights.confidenceScore}%`)
    console.log(`  • Recommended Actions: ${summary.aiInsights.recommendedActions.join(', ')}`)
    
    console.log('\n✅ Test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testConversationSummary()
  .then(() => {
    console.log('\n🎉 Conversation Summary System test completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Test failed with error:', error)
    process.exit(1)
  })
