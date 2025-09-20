#!/usr/bin/env tsx

/**
 * Database setup script to create indexes and collections
 * Run with: npx tsx scripts/setup-database.ts
 */

import { connectToDatabase, COLLECTIONS } from '../lib/database';

async function createIndexes(db: any) {
  console.log('📊 Creating database indexes...');
  // TODO: Define database indexes if needed
  console.log('⚠️  No indexes defined - skipping index creation');
}

async function createCollections(db: any) {
  console.log('\n📚 Creating collections...');
  
  const collectionNames = Object.values(COLLECTIONS);
  
  for (const collectionName of collectionNames) {
    try {
      // Check if collection exists
      const collections = await db.listCollections({ name: collectionName }).toArray();
      
      if (collections.length === 0) {
        // Create collection with validation schema
        await db.createCollection(collectionName);
        console.log(`✅ Created collection: ${collectionName}`);
      } else {
        console.log(`⚠️  Collection already exists: ${collectionName}`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to create collection ${collectionName}:`, error.message);
    }
  }
}

async function validateConnection(db: any) {
  console.log('\n🔍 Validating database connection...');
  
  try {
    // Test the connection
    await db.admin().ping();
    console.log('✅ Database connection is healthy');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`📁 Found ${collections.length} collections:`);
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });
    
  } catch (error) {
    console.error('❌ Database connection validation failed:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Setting up database for homework system...');
    
    const { db } = await connectToDatabase();
    
    // Validate connection
    await validateConnection(db);
    
    // Create collections
    await createCollections(db);
    
    // Create indexes
    await createIndexes(db);
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run the migration script: npx tsx scripts/migrate-to-database.ts');
    console.log('2. Start the application and test the admin panel');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  main();
}

export { main as setupDatabase };
