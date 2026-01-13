import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { getUsersService } from '../lib/users'
import { ObjectId } from 'mongodb'

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

async function checkLatestSubmission() {
  try {
    const { db } = await connectToDatabase()
    const usersService = await getUsersService()
    
    // Get the most recent submission (sorted by submittedAt descending)
    const latestSubmission = await db.collection(COLLECTIONS.SUBMISSIONS).findOne(
      {
        status: { $in: ['submitted', 'graded'] },
        submittedAt: { $exists: true }
      },
      { sort: { submittedAt: -1 } }
    )
    
    if (!latestSubmission) {
      console.log('❌ No submitted submissions found')
      process.exit(0)
    }
    
    console.log('📋 Latest Submission:\n')
    console.log(`   Submission ID: ${latestSubmission._id}`)
    console.log(`   Student ID: ${latestSubmission.studentId}`)
    console.log(`   Homework Set ID: ${latestSubmission.homeworkSetId}`)
    console.log(`   Status: ${latestSubmission.status}`)
    console.log(`   Submitted At: ${latestSubmission.submittedAt}`)
    console.log(`   Attempt Number: ${latestSubmission.attemptNumber || 0}`)
    
    // Get user info
    const user = await usersService.findUserByIdOrEmail(latestSubmission.studentId)
    if (user) {
      console.log(`\n👤 User Info:`)
      console.log(`   Email: ${user.email || '❌ NO EMAIL'}`)
      console.log(`   Name: ${user.name || 'N/A'}`)
      console.log(`   User ID: ${user._id}`)
    } else {
      console.log(`\n❌ User NOT found for studentId: ${latestSubmission.studentId}`)
    }
    
    // Get homework set info
    const homeworkSet = await db.collection(COLLECTIONS.HOMEWORK_SETS).findOne({
      $or: [
        { _id: new ObjectId(latestSubmission.homeworkSetId) },
        { _id: latestSubmission.homeworkSetId },
        { id: latestSubmission.homeworkSetId }
      ]
    })
    
    if (homeworkSet) {
      console.log(`\n📚 Homework Set:`)
      console.log(`   Title: ${homeworkSet.title || 'N/A'}`)
      console.log(`   ID: ${homeworkSet._id}`)
    }
    
    console.log(`\n💡 To resend email to this student, run:`)
    if (user?.email) {
      console.log(`   npx tsx scripts/resend-submission-email.ts ${user.email} ${latestSubmission.homeworkSetId}`)
    }
    console.log(`   npx tsx scripts/resend-submission-email.ts ${latestSubmission._id}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkLatestSubmission().catch(console.error)
