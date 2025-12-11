import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { ObjectId } from 'mongodb'
import fs from 'fs'
import path from 'path'

async function analyzeStudentData(email: string) {
  console.log(`🔍 Analyzing data for student: ${email}`)
  
  try {
    const { db } = await connectToDatabase()
    
    // Find the user by email
    const user = await db.collection(COLLECTIONS.USERS).findOne({ email: email })
    if (!user) {
      console.error(`❌ User not found: ${email}`)
      return
    }
    
    console.log(`✅ Found user: ${user._id}`)
    
    // Extract data from all collections
    const [
      studentProfile,
      studentActivities,
      conversationSummaries,
      chatSessions,
      chatMessages,
      homeworkSubmissions,
      userPoints,
      feedbacks
    ] = await Promise.all([
      // Student Profile
      db.collection(COLLECTIONS.STUDENT_PROFILES).findOne({ userId: user._id.toString() }),
      
      // Student Activities
      db.collection(COLLECTIONS.STUDENT_ACTIVITIES).find({ userId: email }).toArray(),
      
      // Conversation Summaries
      db.collection(COLLECTIONS.CONVERSATION_SUMMARIES).find({ userId: email }).toArray(),
      
      // Chat Sessions
      db.collection(COLLECTIONS.CHAT_SESSIONS).find({ userId: email }).toArray(),
      
      // Chat Messages (we'll get these after we have the sessions)
      Promise.resolve([]), // Placeholder - we'll populate this later
      
      // Homework Submissions
      db.collection(COLLECTIONS.SUBMISSIONS).find({ studentId: email }).toArray(),
      
      // User Points
      db.collection(COLLECTIONS.USER_POINTS).find({ userId: email }).toArray(),
      
      // Feedbacks
      db.collection(COLLECTIONS.FEEDBACKS).find({ userId: email }).toArray()
    ])
    
    // Now get all messages for the user's chat sessions
    const allMessages = []
    for (const session of chatSessions) {
      const sessionMessages = await db.collection(COLLECTIONS.CHAT_MESSAGES)
        .find({ chatId: session._id })
        .toArray()
      allMessages.push(...sessionMessages)
    }
    // Override the empty chatMessages with the actual messages
    chatMessages.length = 0
    chatMessages.push(...allMessages)
    
    // Create comprehensive analysis
    const analysis = {
      studentInfo: {
        userId: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      
      profile: studentProfile || null,
      
      activities: {
        total: studentActivities.length,
        byType: studentActivities.reduce((acc, activity) => {
          acc[activity.activityType] = (acc[activity.activityType] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        data: studentActivities
      },
      
      conversations: {
        summaries: {
          total: conversationSummaries.length,
          data: conversationSummaries
        },
        sessions: {
          total: chatSessions.length,
          data: chatSessions
        },
        messages: {
          total: chatMessages.length,
          byRole: chatMessages.reduce((acc, msg) => {
            acc[msg.role] = (acc[msg.role] || 0) + 1
            return acc
          }, {} as Record<string, number>),
          data: chatMessages
        }
      },
      
      homework: {
        submissions: {
          total: homeworkSubmissions.length,
          data: homeworkSubmissions
        }
      },
      
      engagement: {
        userPoints: {
          total: userPoints.length,
          data: userPoints
        },
        feedbacks: {
          total: feedbacks.length,
          data: feedbacks
        }
      },
      
      analytics: {
        totalChatSessions: chatSessions.length,
        totalMessages: chatMessages.length,
        totalConversationSummaries: conversationSummaries.length,
        totalActivities: studentActivities.length,
        totalHomeworkSubmissions: homeworkSubmissions.length,
        averageSessionDuration: chatSessions.length > 0 
          ? chatSessions.reduce((sum, session) => {
              const duration = session.lastMessageTimestamp 
                ? (new Date(session.lastMessageTimestamp).getTime() - new Date(session.createdAt).getTime()) / (1000 * 60)
                : 0
              return sum + duration
            }, 0) / chatSessions.length
          : 0,
        mostActiveTopics: conversationSummaries.flatMap(summary => summary.keyTopics || [])
          .reduce((acc, topic) => {
            acc[topic] = (acc[topic] || 0) + 1
            return acc
          }, {} as Record<string, number>),
        commonChallenges: conversationSummaries.flatMap(summary => summary.learningIndicators?.challengeAreas || [])
          .reduce((acc, challenge) => {
            acc[challenge] = (acc[challenge] || 0) + 1
            return acc
          }, {} as Record<string, number>)
      },
      
      generatedAt: new Date().toISOString()
    }
    
    // Export to JSON file
    const outputDir = path.join(process.cwd(), 'exports')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    const filename = `student-analysis-${email.replace('@', '-at-').replace('.', '-')}-${Date.now()}.json`
    const filepath = path.join(outputDir, filename)
    
    fs.writeFileSync(filepath, JSON.stringify(analysis, null, 2))
    
    console.log(`\n📊 Analysis Summary:`)
    console.log(`👤 Student: ${email}`)
    console.log(`📈 Profile: ${studentProfile ? 'Found' : 'Not found'}`)
    console.log(`💬 Chat Sessions: ${chatSessions.length}`)
    console.log(`💭 Messages: ${chatMessages.length}`)
    console.log(`📝 Conversation Summaries: ${conversationSummaries.length}`)
    console.log(`📊 Activities: ${studentActivities.length}`)
    console.log(`📚 Homework Submissions: ${homeworkSubmissions.length}`)
    console.log(`⏱️ Average Session Duration: ${analysis.analytics.averageSessionDuration.toFixed(1)} minutes`)
    
    if (Object.keys(analysis.analytics.mostActiveTopics).length > 0) {
      console.log(`\n🎯 Most Active Topics:`)
      Object.entries(analysis.analytics.mostActiveTopics)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .forEach(([topic, count]) => {
          console.log(`  • ${topic}: ${count} times`)
        })
    }
    
    if (Object.keys(analysis.analytics.commonChallenges).length > 0) {
      console.log(`\n⚠️ Common Challenges:`)
      Object.entries(analysis.analytics.commonChallenges)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .forEach(([challenge, count]) => {
          console.log(`  • ${challenge}: ${count} times`)
        })
    }
    
    console.log(`\n💾 Data exported to: ${filepath}`)
    
    return analysis
    
  } catch (error) {
    console.error('❌ Error analyzing student data:', error)
    throw error
  }
}

// Run the analysis
const studentEmail = 'orperets11@gmail.com'
analyzeStudentData(studentEmail)
  .then(() => {
    console.log('\n✅ Student data analysis completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Analysis failed:', error)
    process.exit(1)
  })
