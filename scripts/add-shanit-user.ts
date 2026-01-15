#!/usr/bin/env ts-node

import { createUser } from '../lib/users.js';

async function addUser(): Promise<void> {
  console.log('🔌 Connecting to MongoDB...');
  
  try {
    console.log('✅ Starting user creation...');
    
    // Define the user to add
    const userData = {
      email: 'shanitkur43@gmail.com',
      password: 'shenkar',
      firstName: 'שנית',
      lastName: 'קורצר',
      isFirst: true
    };
    
    console.log(`📤 Adding user to MongoDB...`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Name: ${userData.firstName} ${userData.lastName}`);
    console.log(`   isFirst: ${userData.isFirst}`);
    
    // Use the createUser function from lib/users.ts
    const result = await createUser(userData);
    
    if (result.success) {
      console.log(`✅ User added successfully!`);
      console.log(`   Inserted ID: ${result.insertedId}`);
    } else {
      console.log(`⚠️  ${result.error || 'Failed to add user'}`);
    }
    
    console.log('\n✨ Process completed!');
    
  } catch (error) {
    console.error('❌ Error adding user to MongoDB:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting process to add new user to MongoDB...\n');
    await addUser();
  } catch (error) {
    console.error('❌ Process failed:', error);
  }
}

// Run the script
main().catch(console.error);

export { addUser };

