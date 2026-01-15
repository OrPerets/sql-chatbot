import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { ObjectId } from 'mongodb'

const STUDENT_EMAIL = 'rotemtzubara1@gmail.com'
const STUDENT_ID = '211991492'

async function checkStudentSubmission() {
  console.log(`🔍 Checking submission for student: ${STUDENT_EMAIL} (ID: ${STUDENT_ID})\n`)
  
  try {
    const { db } = await connectToDatabase()
    
    // 1. Find user by email
    console.log('1️⃣ Checking user in database...')
    const user = await db.collection(COLLECTIONS.USERS).findOne({ 
      $or: [
        { email: STUDENT_EMAIL },
        { id: STUDENT_ID }
      ]
    })
    
    if (user) {
      console.log('✅ User found:')
      console.log(`   _id: ${user._id}`)
      console.log(`   email: ${user.email}`)
      console.log(`   id: ${user.id}`)
      console.log(`   name: ${user.name || 'N/A'}`)
    } else {
      console.log('❌ User NOT found in database!')
      console.log('   This could be why email was not sent.')
    }
    
    // 2. Find submissions by studentId (could be email or ID)
    console.log('\n2️⃣ Checking submissions...')
    const submissions = await db.collection(COLLECTIONS.SUBMISSIONS).find({
      $or: [
        { studentId: STUDENT_EMAIL },
        { studentId: STUDENT_ID },
        { studentId: user?._id?.toString() }
      ]
    }).toArray()
    
    if (submissions.length > 0) {
      console.log(`✅ Found ${submissions.length} submission(s):`)
      for (let idx = 0; idx < submissions.length; idx++) {
        const sub = submissions[idx]
        console.log(`\n   Submission ${idx + 1}:`)
        console.log(`   _id: ${sub._id}`)
        console.log(`   studentId: ${sub.studentId}`)
        console.log(`   homeworkSetId: ${sub.homeworkSetId}`)
        console.log(`   status: ${sub.status}`)
        console.log(`   submittedAt: ${sub.submittedAt || 'N/A'}`)
        console.log(`   attemptNumber: ${sub.attemptNumber || 0}`)
        console.log(`   answers count: ${Object.keys(sub.answers || {}).length}`)
        
        // Check if it's homework 3
        if (sub.homeworkSetId) {
          const homeworkSet = await db.collection(COLLECTIONS.HOMEWORK_SETS).findOne({
            $or: [
              { _id: new ObjectId(sub.homeworkSetId) },
              { _id: sub.homeworkSetId },
              { id: sub.homeworkSetId }
            ]
          })
          if (homeworkSet) {
            console.log(`   homework title: ${homeworkSet.title || 'N/A'}`)
          }
        }
      }
    } else {
      console.log('❌ No submissions found!')
      console.log('   This is the main issue - submission may not have been saved.')
    }
    
    // 3. Check homework sets to find homework 3
    console.log('\n3️⃣ Checking homework sets...')
    const homeworkSets = await db.collection(COLLECTIONS.HOMEWORK_SETS).find({}).toArray()
    console.log(`Found ${homeworkSets.length} homework set(s)`)
    homeworkSets.forEach((hw, idx) => {
      console.log(`   ${idx + 1}. ${hw.title || 'N/A'} (id: ${hw._id})`)
    })
    
    // 4. Summary and recommendations
    console.log('\n📊 Summary:')
    if (!user) {
      console.log('❌ User not found - email lookup will fail')
      console.log('   Recommendation: User needs to be added to database')
    } else if (submissions.length === 0) {
      console.log('❌ No submissions found - submission may have failed to save')
      console.log('   Recommendation: Check submission logs for errors')
    } else {
      const submittedSubmissions = submissions.filter(s => s.status === 'submitted' || s.status === 'graded')
      if (submittedSubmissions.length > 0) {
        console.log(`✅ Found ${submittedSubmissions.length} submitted submission(s)`)
        console.log('   Recommendation: Check email sending logs for failures')
      } else {
        console.log('⚠️ Submissions found but none are in "submitted" status')
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking submission:', error)
  }
}

checkStudentSubmission().catch(console.error)
