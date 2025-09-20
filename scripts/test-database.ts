#!/usr/bin/env tsx

/**
 * Test script to verify database connection and basic operations
 * Run with: npx tsx scripts/test-database.ts
 */

import { connectToDatabase, COLLECTIONS } from '../lib/database';
import { createDataset } from '../lib/datasets';
import { createHomeworkSet } from '../lib/homework';

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const { db } = await connectToDatabase();
    await db.admin().ping();
    console.log('✅ Database connection successful');
    return db;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function testDatasetOperations(db: any) {
  console.log('\n📁 Testing dataset operations...');
  
  try {
    // Test creating a dataset
    const testDataset = await createDataset({
      name: 'Test Dataset',
      description: 'A test dataset for verification',
      scenario: 'Test scenario',
      story: 'Test story',
      connectionUri: 'sandbox://test',
      previewTables: [
        { name: 'test_table', columns: ['id', 'name'] }
      ],
      tags: ['test', 'verification'],
    });
    
    console.log('✅ Dataset created successfully:', testDataset.id);
    
    // Clean up
    await db.collection(COLLECTIONS.DATASETS).deleteOne({ id: testDataset.id });
    console.log('✅ Dataset cleaned up');
    
  } catch (error) {
    console.error('❌ Dataset operations failed:', error);
    throw error;
  }
}

async function testHomeworkOperations(db: any) {
  console.log('\n📚 Testing homework operations...');
  
  try {
    // Test creating a homework set
    const testHomework = await createHomeworkSet({
      title: 'Test Homework',
      courseId: 'TEST101',
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      published: false,
      datasetPolicy: 'shared',
      questionOrder: [],
      visibility: 'draft',
      createdBy: 'test-instructor',
      overview: 'A test homework set',
    });
    
    console.log('✅ Homework set created successfully:', testHomework.id);
    
    // Clean up
    await db.collection(COLLECTIONS.HOMEWORK_SETS).deleteOne({ id: testHomework.id });
    console.log('✅ Homework set cleaned up');
    
  } catch (error) {
    console.error('❌ Homework operations failed:', error);
    throw error;
  }
}

async function testCollections(db: any) {
  console.log('\n📊 Testing collections...');
  
  const expectedCollections = Object.values(COLLECTIONS);
  const actualCollections = await db.listCollections().toArray();
  const actualCollectionNames = actualCollections.map(col => col.name);
  
  console.log('Expected collections:', expectedCollections);
  console.log('Actual collections:', actualCollectionNames);
  
  const missingCollections = expectedCollections.filter(name => !actualCollectionNames.includes(name));
  
  if (missingCollections.length > 0) {
    console.warn('⚠️  Missing collections:', missingCollections);
    console.log('Run the setup script to create missing collections: npx tsx scripts/setup-database.ts');
  } else {
    console.log('✅ All expected collections exist');
  }
}

async function main() {
  try {
    console.log('🚀 Starting database tests...');
    
    // Test connection
    const db = await testDatabaseConnection();
    
    // Test collections
    await testCollections(db);
    
    // Test dataset operations
    await testDatasetOperations(db);
    
    // Test homework operations
    await testHomeworkOperations(db);
    
    console.log('\n🎉 All database tests passed!');
    console.log('\nNext steps:');
    console.log('1. Run the setup script: npx tsx scripts/setup-database.ts');
    console.log('2. Run the migration script: npx tsx scripts/migrate-to-database.ts');
    console.log('3. Start the application and test the admin panel');
    
  } catch (error) {
    console.error('❌ Database tests failed:', error);
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  main();
}

export { main as testDatabase };
