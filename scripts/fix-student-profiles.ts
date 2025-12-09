import { connectToDatabase, COLLECTIONS } from '../lib/database'
import { ObjectId } from 'mongodb'

async function fixStudentProfiles() {
  console.log('🔧 Fixing student profiles with correct names and emails...')
  
  try {
    const { db } = await connectToDatabase()
    
    // Get all profiles
    const profiles = await db.collection(COLLECTIONS.STUDENT_PROFILES).find({}).toArray()
    console.log(`📊 Found ${profiles.length} profiles to fix`)
    
    let fixed = 0
    
    for (const profile of profiles) {
      try {
        // Convert userId to ObjectId for lookup
        const userId = new ObjectId(profile.userId)
        const user = await db.collection(COLLECTIONS.USERS).findOne({ _id: userId })
        
        if (user) {
          const name = user.name || user.email?.split('@')[0] || 'ללא שם'
          const email = user.email || 'ללא אימייל'
          
          // Update the profile with correct name and email
          await db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
            { _id: profile._id },
            {
              $set: {
                name: name,
                email: email,
                updatedAt: new Date()
              }
            }
          )
          
          console.log(`✅ Fixed profile for ${email} (${name})`)
          fixed++
        } else {
          console.log(`❌ User not found for profile ${profile._id}`)
        }
      } catch (error) {
        console.error(`❌ Error fixing profile ${profile._id}:`, error)
      }
    }
    
    console.log(`🎉 Fixed ${fixed} out of ${profiles.length} profiles`)
    
  } catch (error) {
    console.error('❌ Error fixing profiles:', error)
  }
}

fixStudentProfiles()
  .then(() => {
    console.log('\n✅ Profile fixing completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Profile fixing failed:', error)
    process.exit(1)
  })
