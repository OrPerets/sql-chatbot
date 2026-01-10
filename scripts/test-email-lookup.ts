import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { getUsersService } from '../lib/users'
import { ObjectId } from 'mongodb'

const STUDENT_EMAIL = 'rotemtzubara1@gmail.com'
const STUDENT_OBJECT_ID = '68f080c5b12119f72a11a20e'
const SUBMISSION_STUDENT_ID = '68f080c5b12119f72a11a20e' // This is what's in the submission

async function testEmailLookup() {
  console.log('🧪 Testing email lookup for submission student ID\n')
  
  try {
    const { db } = await connectToDatabase()
    const usersService = await getUsersService()
    
    // Test 1: Find user by ObjectId (what's in submission)
    console.log(`1️⃣ Testing lookup by ObjectId: ${SUBMISSION_STUDENT_ID}`)
    const userByObjectId = await usersService.findUserByIdOrEmail(SUBMISSION_STUDENT_ID)
    if (userByObjectId) {
      console.log(`✅ Found user by ObjectId:`)
      console.log(`   email: ${userByObjectId.email}`)
      console.log(`   _id: ${userByObjectId._id}`)
      console.log(`   name: ${userByObjectId.name || 'N/A'}`)
    } else {
      console.log(`❌ User NOT found by ObjectId`)
    }
    
    // Test 2: Find user by email
    console.log(`\n2️⃣ Testing lookup by email: ${STUDENT_EMAIL}`)
    const userByEmail = await usersService.findUserByIdOrEmail(STUDENT_EMAIL)
    if (userByEmail) {
      console.log(`✅ Found user by email:`)
      console.log(`   email: ${userByEmail.email}`)
      console.log(`   _id: ${userByEmail._id}`)
    } else {
      console.log(`❌ User NOT found by email`)
    }
    
    // Test 3: Direct database query
    console.log(`\n3️⃣ Direct database query by ObjectId`)
    const directUser = await db.collection(COLLECTIONS.USERS).findOne({
      _id: new ObjectId(SUBMISSION_STUDENT_ID)
    })
    if (directUser) {
      console.log(`✅ Found user directly:`)
      console.log(`   email: ${directUser.email}`)
      console.log(`   _id: ${directUser._id}`)
    } else {
      console.log(`❌ User NOT found directly`)
    }
    
    // Test 4: Check submission
    console.log(`\n4️⃣ Checking submission`)
    const submission = await db.collection(COLLECTIONS.SUBMISSIONS).findOne({
      studentId: SUBMISSION_STUDENT_ID
    })
    if (submission) {
      console.log(`✅ Submission found:`)
      console.log(`   studentId: ${submission.studentId}`)
      console.log(`   status: ${submission.status}`)
      console.log(`   submittedAt: ${submission.submittedAt}`)
    }
    
    // Summary
    console.log(`\n📊 Summary:`)
    if (userByObjectId && userByObjectId.email) {
      console.log(`✅ Email lookup should work: ${userByObjectId.email}`)
    } else {
      console.log(`❌ Email lookup will FAIL - user not found`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testEmailLookup().catch(console.error)
