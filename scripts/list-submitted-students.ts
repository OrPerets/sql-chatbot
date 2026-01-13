import { config } from 'dotenv'
import { resolve } from 'path'
import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { getUsersService } from '../lib/users'
import { ObjectId } from 'mongodb'

// Load environment variables from .env.local or .env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

// Usage: npx tsx scripts/list-submitted-students.ts <homeworkSetId>
async function listSubmittedStudents() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log('Usage:')
    console.log('  npx tsx scripts/list-submitted-students.ts <homeworkSetId>')
    console.log('\nExample:')
    console.log('  npx tsx scripts/list-submitted-students.ts 693d8a930a7ebe39f7099c88')
    process.exit(1)
  }
  
  const homeworkSetId = args[0]
  
  try {
    const { db } = await connectToDatabase()
    const usersService = await getUsersService()
    
    // Get homework set info (using the same pattern as getHomeworkSetById)
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
    
    // Get user info for each submission
    const studentInfo: Array<{
      submissionId: string
      studentId: string
      email: string | null
      name: string | null
      submittedAt: string | null
      status: string
    }> = []
    
    for (const submission of submissions) {
      const studentId = submission.studentId
      const user = await usersService.findUserByIdOrEmail(studentId)
      
      studentInfo.push({
        submissionId: submission._id.toString(),
        studentId: studentId,
        email: user?.email || null,
        name: user?.name || null,
        submittedAt: submission.submittedAt || null,
        status: submission.status || 'submitted',
      })
    }
    
    // Sort by submitted date (most recent first)
    studentInfo.sort((a, b) => {
      if (!a.submittedAt) return 1
      if (!b.submittedAt) return -1
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    })
    
    // Display results
    console.log('📋 Submitted Students:\n')
    console.log('─'.repeat(100))
    console.log(
      `${'#'.padEnd(4)} | ${'Student ID'.padEnd(30)} | ${'Email'.padEnd(35)} | ${'Name'.padEnd(20)} | Status`.padEnd(100)
    )
    console.log('─'.repeat(100))
    
    let hasEmailCount = 0
    let missingEmailCount = 0
    
    studentInfo.forEach((info, index) => {
      const num = (index + 1).toString().padEnd(4)
      const studentId = (info.studentId || 'N/A').substring(0, 30).padEnd(30)
      const email = (info.email || '❌ NO EMAIL').substring(0, 35).padEnd(35)
      const name = (info.name || 'N/A').substring(0, 20).padEnd(20)
      const status = info.status || 'submitted'
      const submittedDate = info.submittedAt 
        ? new Date(info.submittedAt).toLocaleDateString('he-IL', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'N/A'
      
      console.log(`${num} | ${studentId} | ${email} | ${name} | ${status}`)
      
      if (info.email) {
        hasEmailCount++
      } else {
        missingEmailCount++
      }
    })
    
    console.log('─'.repeat(100))
    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Total submissions: ${submissions.length}`)
    console.log(`   📧 With email: ${hasEmailCount}`)
    console.log(`   ❌ Missing email: ${missingEmailCount}`)
    console.log(`\n💡 To send emails to all students with emails, run:`)
    console.log(`   npx tsx scripts/resend-emails-to-all-submissions.ts ${homeworkSetId}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

listSubmittedStudents().catch(console.error)
