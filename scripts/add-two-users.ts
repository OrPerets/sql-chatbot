#!/usr/bin/env ts-node

import { connectToDatabase, COLLECTIONS } from '../lib/database';

interface UserDocument {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isFirst: boolean;
}

async function addUsers(): Promise<void> {
  console.log('🔌 Connecting to MongoDB...');
  
  try {
    const { db } = await connectToDatabase();
    console.log('✅ Connected to database successfully!');
    
    // Define the two new users
    const users: UserDocument[] = [
      {
        email: 'lotan3600@gmail.com',
        password: 'shenkar',
        firstName: 'לוטן',
        lastName: 'חדד',
        isFirst: true
      },
      {
        email: 'yaelcohen318@gmail.com',
        password: 'shenkar',
        firstName: 'יעל',
        lastName: 'כהן',
        isFirst: true
      }
    ];
    
    console.log(`📤 Adding ${users.length} users to MongoDB...`);
    
    // Check if users already exist by email and add them
    for (const user of users) {
      const existingUser = await db.collection(COLLECTIONS.USERS).findOne({ email: user.email });
      
      if (existingUser) {
        console.log(`⚠️  User with email ${user.email} already exists, skipping...`);
      } else {
        // Insert user
        const result = await db.collection(COLLECTIONS.USERS).insertOne(user);
        console.log(`✅ Added user: ${user.firstName} ${user.lastName} (${user.email}) - ID: ${result.insertedId}`);
      }
    }
    
    // Verify the insertion
    console.log('\n🔍 Verifying users in database...');
    for (const user of users) {
      const found = await db.collection(COLLECTIONS.USERS).findOne({ email: user.email });
      if (found) {
        console.log(`✅ Verified: ${found.firstName} ${found.lastName} (${found.email})`);
      } else {
        console.log(`❌ Not found: ${user.email}`);
      }
    }
    
    const totalCount = await db.collection(COLLECTIONS.USERS).countDocuments();
    console.log(`\n📊 Total users in collection: ${totalCount}`);
    
  } catch (error) {
    console.error('❌ Error adding users to MongoDB:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting process to add 2 new users to MongoDB...\n');
    await addUsers();
    console.log('\n✨ Users added successfully!');
  } catch (error) {
    console.error('❌ Process failed:', error);
    process.exit(1);
  }
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export { addUsers };
