import { connectToDatabase, COLLECTIONS } from '../lib/database'

async function createStudentProfilesCollections() {
  console.log('🏗️  Setting up Student Profiles collections...')
  
  try {
    const { db } = await connectToDatabase()
    
    // Create student_profiles collection
    try {
      await db.createCollection(COLLECTIONS.STUDENT_PROFILES)
      console.log(`✅ Created collection: ${COLLECTIONS.STUDENT_PROFILES}`)
    } catch (error: any) {
      if (error.code === 48) { // Collection already exists
        console.log(`ℹ️  Collection already exists: ${COLLECTIONS.STUDENT_PROFILES}`)
      } else {
        console.error(`❌ Failed to create collection ${COLLECTIONS.STUDENT_PROFILES}:`, error.message)
      }
    }

    // Create student_activities collection
    try {
      await db.createCollection(COLLECTIONS.STUDENT_ACTIVITIES)
      console.log(`✅ Created collection: ${COLLECTIONS.STUDENT_ACTIVITIES}`)
    } catch (error: any) {
      if (error.code === 48) { // Collection already exists
        console.log(`ℹ️  Collection already exists: ${COLLECTIONS.STUDENT_ACTIVITIES}`)
      } else {
        console.error(`❌ Failed to create collection ${COLLECTIONS.STUDENT_ACTIVITIES}:`, error.message)
      }
    }

    console.log('📊 Creating indexes for Student Profiles...')
    
    // Create indexes for student_profiles collection
    const studentProfilesIndexes = [
      { key: { userId: 1 }, options: { unique: true, name: 'userId_unique' } },
      { key: { knowledgeScore: 1 }, options: { name: 'knowledgeScore_index' } },
      { key: { 'riskFactors.isAtRisk': 1 }, options: { name: 'isAtRisk_index' } },
      { key: { 'riskFactors.riskLevel': 1 }, options: { name: 'riskLevel_index' } },
      { key: { lastActivity: -1 }, options: { name: 'lastActivity_desc' } },
      { key: { averageGrade: -1 }, options: { name: 'averageGrade_desc' } },
      { key: { createdAt: -1 }, options: { name: 'createdAt_desc' } },
      { key: { updatedAt: -1 }, options: { name: 'updatedAt_desc' } }
    ]

    for (const index of studentProfilesIndexes) {
      try {
        await db.collection(COLLECTIONS.STUDENT_PROFILES).createIndex(index.key, index.options)
        console.log(`✅ Created index: ${index.options.name}`)
      } catch (error: any) {
        if (error.code === 85) { // Index already exists
          console.log(`ℹ️  Index already exists: ${index.options.name}`)
        } else {
          console.error(`❌ Failed to create index ${index.options.name}:`, error.message)
        }
      }
    }

    // Create indexes for student_activities collection
    const studentActivitiesIndexes = [
      { key: { userId: 1 }, options: { name: 'userId_index' } },
      { key: { activityType: 1 }, options: { name: 'activityType_index' } },
      { key: { timestamp: -1 }, options: { name: 'timestamp_desc' } },
      { key: { userId: 1, timestamp: -1 }, options: { name: 'userId_timestamp_compound' } },
      { key: { sessionId: 1 }, options: { name: 'sessionId_index' } }
    ]

    for (const index of studentActivitiesIndexes) {
      try {
        await db.collection(COLLECTIONS.STUDENT_ACTIVITIES).createIndex(index.key, index.options)
        console.log(`✅ Created index: ${index.options.name}`)
      } catch (error: any) {
        if (error.code === 85) { // Index already exists
          console.log(`ℹ️  Index already exists: ${index.options.name}`)
        } else {
          console.error(`❌ Failed to create index ${index.options.name}:`, error.message)
        }
      }
    }

    console.log('🎉 Student Profiles collections setup completed successfully!')
    
  } catch (error) {
    console.error('❌ Error setting up Student Profiles collections:', error)
    throw error
  }
}

async function main() {
  try {
    await createStudentProfilesCollections()
    process.exit(0)
  } catch (error) {
    console.error('Setup failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

export { createStudentProfilesCollections }
