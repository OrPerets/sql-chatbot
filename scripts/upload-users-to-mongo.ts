#!/usr/bin/env ts-node

import { connectToDatabase, COLLECTIONS } from '../lib/database';
import * as fs from 'fs';
import { ObjectId } from 'mongodb';

/**
 * Clear users collection and upload cleaned users data from JSON file
 */

interface UserDocument {
  _id?: string;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  isFirst?: boolean;
  [key: string]: any;
}

interface UsersExport {
  collection: string;
  exportDate: string;
  documentCount: number;
  documents: UserDocument[];
}

async function uploadUsersToMongo(jsonFilePath: string): Promise<void> {
  console.log(`📖 Reading users from: ${jsonFilePath}`);
  
  try {
    // Connect to database
    console.log('🔌 Connecting to MongoDB...');
    const { db } = await connectToDatabase();
    console.log('✅ Connected to database successfully!');
    
    // Read the JSON file
    const content = fs.readFileSync(jsonFilePath, 'utf8');
    const data: UsersExport = JSON.parse(content);
    
    console.log(`📊 Found ${data.documents.length} users in JSON file`);
    
    // Clear the existing users collection
    console.log('🗑️ Clearing existing users collection...');
    const deleteResult = await db.collection(COLLECTIONS.USERS).deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} existing users`);
    
    // Prepare users for insertion
    console.log('🔄 Preparing users for insertion...');
    const usersToInsert = data.documents.map(user => {
      const userDoc = { ...user };
      
      // Remove _id from users that have it (MongoDB will generate new ones)
      if (userDoc._id) {
        delete userDoc._id;
      }
      
      return userDoc;
    });
    
    // Insert all users
    console.log(`📤 Inserting ${usersToInsert.length} users into MongoDB...`);
    const insertResult = await db.collection(COLLECTIONS.USERS).insertMany(usersToInsert);
    
    console.log(`✅ Successfully inserted ${insertResult.insertedCount} users`);
    console.log(`📊 Inserted IDs: ${Object.keys(insertResult.insertedIds).length} new documents`);
    
    // Verify the insertion
    console.log('🔍 Verifying insertion...');
    const count = await db.collection(COLLECTIONS.USERS).countDocuments();
    console.log(`✅ Users collection now contains ${count} users`);
    
    // Show some sample inserted users
    console.log('\n👥 Sample of inserted users:');
    const sampleUsers = await db.collection(COLLECTIONS.USERS).find({}).limit(3).toArray();
    sampleUsers.forEach((user, index) => {
      console.log(`  User ${index + 1}:`);
      console.log(`    _id: ${user._id}`);
      console.log(`    email: ${user.email}`);
      console.log(`    firstName: ${user.firstName}`);
      console.log(`    lastName: ${user.lastName}`);
      console.log('');
    });
    
    // Show statistics
    console.log('📊 Upload Statistics:');
    console.log(`  - Users deleted: ${deleteResult.deletedCount}`);
    console.log(`  - Users inserted: ${insertResult.insertedCount}`);
    console.log(`  - Total in collection: ${count}`);
    
    if (insertResult.insertedCount !== usersToInsert.length) {
      console.warn(`⚠️ Warning: Expected to insert ${usersToInsert.length} users, but inserted ${insertResult.insertedCount}`);
    }
    
  } catch (error) {
    console.error('❌ Error uploading users to MongoDB:', error);
    throw error;
  }
}

async function main() {
  try {
    const jsonFilePath = './exports/users_cleaned.json';
    
    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
      console.error(`❌ File not found: ${jsonFilePath}`);
      console.log('Please make sure the users_cleaned.json file exists in the exports directory.');
      process.exit(1);
    }
    
    console.log('🚀 Starting MongoDB users upload process...');
    console.log('⚠️ This will DELETE ALL existing users and replace them with the JSON data!');
    
    await uploadUsersToMongo(jsonFilePath);
    
    console.log('\n✨ Users upload completed successfully!');
    console.log('🎉 Your MongoDB users collection has been updated with the cleaned data.');
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export { uploadUsersToMongo };
