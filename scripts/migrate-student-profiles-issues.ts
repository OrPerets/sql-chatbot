#!/usr/bin/env ts-node

import { connectToDatabase, executeWithRetry, COLLECTIONS } from '../lib/database'

/**
 * Migration script to add issue tracking fields to existing student profiles
 */
async function migrateStudentProfilesForIssues() {
  console.log('🔄 Starting migration to add issue tracking fields to student profiles...')
  
  try {
    const result = await executeWithRetry(async (db) => {
      // Get all student profiles that don't have the new fields
      const profilesToUpdate = await db.collection(COLLECTIONS.STUDENT_PROFILES)
        .find({
          $or: [
            { issueCount: { $exists: false } },
            { issueHistory: { $exists: false } },
            { lastIssueUpdate: { $exists: false } }
          ]
        })
        .toArray()

      console.log(`📊 Found ${profilesToUpdate.length} profiles to update`)

      let updated = 0
      let errors = 0

      for (const profile of profilesToUpdate) {
        try {
          const now = new Date()
          
          // Prepare update object with new fields
          const updateFields: any = {
            updatedAt: now
          }

          // Add issueCount if missing
          if (profile.issueCount === undefined) {
            updateFields.issueCount = 0
          }

          // Add issueHistory if missing
          if (profile.issueHistory === undefined) {
            updateFields.issueHistory = []
          }

          // Add lastIssueUpdate if missing
          if (profile.lastIssueUpdate === undefined) {
            updateFields.lastIssueUpdate = now
          }

          // Update the profile
          await db.collection(COLLECTIONS.STUDENT_PROFILES).updateOne(
            { _id: profile._id },
            { $set: updateFields }
          )

          updated++
          console.log(`✅ Updated profile for user: ${profile.email || profile.name || profile.userId}`)
        } catch (error) {
          errors++
          console.error(`❌ Error updating profile ${profile._id}:`, error)
        }
      }

      return {
        total: profilesToUpdate.length,
        updated,
        errors
      }
    })

    console.log('🎉 Migration completed!')
    console.log(`📈 Results:`)
    console.log(`   - Total profiles processed: ${result.total}`)
    console.log(`   - Successfully updated: ${result.updated}`)
    console.log(`   - Errors: ${result.errors}`)

    if (result.errors > 0) {
      console.log('⚠️  Some profiles failed to update. Check the logs above for details.')
    }

  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateStudentProfilesForIssues()
    .then(() => {
      console.log('✅ Migration script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error)
      process.exit(1)
    })
}

export { migrateStudentProfilesForIssues }
