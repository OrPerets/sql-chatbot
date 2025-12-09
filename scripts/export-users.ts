#!/usr/bin/env ts-node

import { connectToDatabase, COLLECTIONS } from '../lib/database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Export users collection from MongoDB to local JSON file
 */

interface ExportOptions {
  outputDir?: string;
  prettyPrint?: boolean;
  includeMetadata?: boolean;
}

async function exportUsers(options: ExportOptions = {}): Promise<void> {
  const { 
    outputDir = './exports', 
    prettyPrint = true, 
    includeMetadata = true 
  } = options;

  console.log('🔌 Connecting to MongoDB...');
  
  try {
    const { db } = await connectToDatabase();
    console.log('✅ Connected to database successfully!');
    
    // Create output directory if it doesn't exist
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    } catch (error) {
      console.log(`📁 Using existing output directory: ${outputDir}`);
    }

    console.log('🔄 Exporting users collection...');
    
    // Get all documents from the users collection
    const users = await db.collection(COLLECTIONS.USERS).find({}).toArray();
    console.log(`📊 Found ${users.length} users in the collection`);
    
    // Convert MongoDB ObjectId and Date objects to serializable format
    const serializedUsers = users.map(user => {
      return JSON.parse(JSON.stringify(user, (key, value) => {
        // Handle ObjectId
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId') {
          return { $oid: value.toString() };
        }
        // Handle Date
        if (value instanceof Date) {
          return { $date: value.toISOString() };
        }
        return value;
      }));
    });
    
    // Create export data with metadata
    const exportData = includeMetadata ? {
      collection: COLLECTIONS.USERS,
      exportDate: new Date().toISOString(),
      documentCount: users.length,
      documents: serializedUsers
    } : serializedUsers;
    
    // Write to file
    const filename = 'users.json';
    const filepath = path.join(outputDir, filename);
    const jsonString = prettyPrint 
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);
    
    fs.writeFileSync(filepath, jsonString, 'utf8');
    console.log(`✅ Exported users collection to: ${filepath}`);
    
    // Display summary
    console.log('\n📊 Export Summary:');
    console.log(`  Collection: ${COLLECTIONS.USERS}`);
    console.log(`  Documents exported: ${users.length}`);
    console.log(`  Output file: ${filepath}`);
    console.log(`  File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    
    if (users.length > 0) {
      console.log('\n👥 Sample user fields:');
      const sampleUser = users[0];
      const fields = Object.keys(sampleUser).slice(0, 10); // Show first 10 fields
      fields.forEach(field => {
        const value = sampleUser[field];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const preview = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : String(value);
        console.log(`  ${field}: ${type} = ${preview}`);
      });
      if (Object.keys(sampleUser).length > 10) {
        console.log(`  ... and ${Object.keys(sampleUser).length - 10} more fields`);
      }
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await exportUsers({
      outputDir: './exports',
      prettyPrint: true,
      includeMetadata: true
    });
    
    console.log('\n✨ Users export completed successfully!');
    console.log('📁 Check the ./exports/users.json file for your exported data.');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export { exportUsers };
