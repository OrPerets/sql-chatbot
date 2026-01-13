import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { getUsersService } from '../lib/users'
import { ObjectId } from 'mongodb'

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

/**
 * Interface for documents in the "submitted" collection
 * Tracks students who have submitted homework and received PDF reports
 */
export interface SubmittedStudent {
  _id?: ObjectId
  studentId: string
  email: string
  name?: string
  homeworkSetId: string
  submissionId: string
  receivedReport: boolean // true if they received the PDF report via email
  submittedAt: string | null
  createdAt: Date // When this record was added to the collection
  updatedAt?: Date // When this record was last updated
}

// Usage: npx tsx scripts/populate-submitted-collection.ts <homeworkSetId>
async function populateSubmittedCollection() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Usage:')
    console.log('  npx tsx scripts/populate-submitted-collection.ts <homeworkSetId>')
    console.log('\nExample:')
    console.log('  npx tsx scripts/populate-submitted-collection.ts 693d8a930a7ebe39f7099c88')
    process.exit(1)
  }
  
  const homeworkSetId = args[0]
  
  try {
    const { db } = await connectToDatabase()
    const usersService = await getUsersService()
    
    // Get homework set info
    const isValidObjectId = ObjectId.isValid(homeworkSetId);
    const homeworkSet = await db.collection(COLLECTIONS.HOMEWORK_SETS).findOne({
      $or: isValidObjectId
        ? [{ _id: new ObjectId(homeworkSetId) }, { id: homeworkSetId }]
        : [{ id: homeworkSetId }]
    })
    
    if (!homeworkSet) {
      console.error(`❌ Homework set not found: ${homeworkSetId}`)
      process.exit(1)
    }
    
    console.log(`📚 Homework: ${homeworkSet.title || homeworkSetId}\n`)
    
    // Get all submitted submissions for this homework set
    const submissions = await db.collection(COLLECTIONS.SUBMISSIONS).find({
      homeworkSetId: homeworkSetId,
      status: { $in: ['submitted', 'graded'] }
    }).toArray()
    
    console.log(`📋 Found ${submissions.length} submitted submission(s)\n`)
    
    if (submissions.length === 0) {
      console.log('✅ No submitted submissions found')
      process.exit(0)
    }
    
    // Get the submitted collection
    const submittedCollection = db.collection<SubmittedStudent>(COLLECTIONS.SUBMITTED)
    
    // Create index on studentId + homeworkSetId for fast lookups
    await submittedCollection.createIndex(
      { studentId: 1, homeworkSetId: 1 },
      { unique: true, name: 'student_homework_unique' }
    )
    
    // Create index on email for easy filtering
    await submittedCollection.createIndex({ email: 1 })
    
    // Create index on receivedReport for filtering
    await submittedCollection.createIndex({ receivedReport: 1 })
    
    console.log('✅ Indexes created on submitted collection\n')
    
    // Process each submission
    let insertedCount = 0
    let updatedCount = 0
    let skippedCount = 0
    
    for (const submission of submissions) {
      const studentId = submission.studentId
      const user = await usersService.findUserByIdOrEmail(studentId)
      
      if (!user?.email) {
        console.log(`⚠️  Skipping student ${studentId} - no email found`)
        skippedCount++
        continue
      }
      
      const submittedRecord: SubmittedStudent = {
        studentId: studentId,
        email: user.email,
        name: user.name || undefined,
        homeworkSetId: homeworkSetId,
        submissionId: submission._id.toString(),
        receivedReport: true, // These initial students received the report
        submittedAt: submission.submittedAt || null,
        createdAt: new Date(),
      }
      
      // Use upsert to avoid duplicates
      // Remove createdAt from submittedRecord since it should only be set on insert
      const { createdAt, ...recordToUpdate } = submittedRecord
      
      const result = await submittedCollection.updateOne(
        {
          studentId: studentId,
          homeworkSetId: homeworkSetId
        },
        {
          $set: {
            ...recordToUpdate,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      )
      
      if (result.upsertedCount > 0) {
        insertedCount++
        console.log(`✅ Added: ${user.email} (${user.name || 'N/A'})`)
      } else if (result.modifiedCount > 0) {
        updatedCount++
        console.log(`🔄 Updated: ${user.email} (${user.name || 'N/A'})`)
      } else {
        console.log(`⏭️  Already exists: ${user.email} (${user.name || 'N/A'})`)
      }
    }
    
    console.log('\n' + '─'.repeat(60))
    console.log('📊 Summary:')
    console.log(`   ✅ Inserted: ${insertedCount}`)
    console.log(`   🔄 Updated: ${updatedCount}`)
    console.log(`   ⏭️  Skipped: ${skippedCount}`)
    console.log(`   📋 Total processed: ${submissions.length}`)
    
    // Show collection stats
    const totalInCollection = await submittedCollection.countDocuments({
      homeworkSetId: homeworkSetId
    })
    const withReport = await submittedCollection.countDocuments({
      homeworkSetId: homeworkSetId,
      receivedReport: true
    })
    const withoutReport = await submittedCollection.countDocuments({
      homeworkSetId: homeworkSetId,
      receivedReport: false
    })
    
    console.log('\n📊 Collection Statistics:')
    console.log(`   📋 Total in collection for this homework: ${totalInCollection}`)
    console.log(`   ✅ Received report: ${withReport}`)
    console.log(`   ❌ Not received report: ${withoutReport}`)
    
    console.log('\n💡 Query examples:')
    console.log(`   // Find all students who received report for this homework`)
    console.log(`   db.submitted.find({ homeworkSetId: "${homeworkSetId}", receivedReport: true })`)
    console.log(`   // Find students who submitted but didn't receive report`)
    console.log(`   db.submitted.find({ homeworkSetId: "${homeworkSetId}", receivedReport: false })`)
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

populateSubmittedCollection().catch(console.error)
