#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

/**
 * Clean up users_merged.json file:
 * 1. Remove "class" key from all users
 * 2. Remove "_id" from Excel-imported users (those with excel_ prefix)
 */

interface UserDocument {
  _id?: string;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  isFirst?: boolean;
  class?: string | number;
  [key: string]: any;
}

interface UsersExport {
  collection: string;
  exportDate: string;
  documentCount: number;
  documents: UserDocument[];
}

function isExcelImportedUser(user: UserDocument): boolean {
  return user._id && user._id.startsWith('excel_');
}

async function cleanUsersJson(inputPath: string, outputPath?: string): Promise<void> {
  console.log(`🧹 Cleaning users JSON file: ${inputPath}`);
  
  try {
    // Read the input file
    const content = fs.readFileSync(inputPath, 'utf8');
    const data: UsersExport = JSON.parse(content);
    
    console.log(`📊 Processing ${data.documents.length} users...`);
    
    let excelUsersCount = 0;
    let cleanedCount = 0;
    
    // Clean each user document
    const cleanedDocuments = data.documents.map(user => {
      const cleanedUser = { ...user };
      
      // Remove "class" key from all users
      if ('class' in cleanedUser) {
        delete cleanedUser.class;
        cleanedCount++;
      }
      
      // Remove "_id" from Excel-imported users
      if (isExcelImportedUser(cleanedUser)) {
        delete cleanedUser._id;
        excelUsersCount++;
      }
      
      return cleanedUser;
    });
    
    // Update the data structure
    const cleanedData: UsersExport = {
      ...data,
      documents: cleanedDocuments,
      exportDate: new Date().toISOString()
    };
    
    // Determine output path
    const finalOutputPath = outputPath || inputPath;
    
    // Write the cleaned data
    fs.writeFileSync(finalOutputPath, JSON.stringify(cleanedData, null, 2), 'utf8');
    
    console.log(`✅ Cleaning completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`  - Total users processed: ${data.documents.length}`);
    console.log(`  - "class" key removed from: ${cleanedCount} users`);
    console.log(`  - "_id" removed from Excel users: ${excelUsersCount} users`);
    console.log(`  - Original MongoDB users kept: ${data.documents.length - excelUsersCount} users`);
    console.log(`📁 Output saved to: ${finalOutputPath}`);
    
    // Show sample of cleaned users
    console.log(`\n👤 Sample cleaned users:`);
    cleanedDocuments.slice(0, 3).forEach((user, index) => {
      console.log(`  User ${index + 1}:`);
      Object.entries(user).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error cleaning users JSON:', error);
    throw error;
  }
}

async function main() {
  try {
    const inputPath = './exports/users_merged.json';
    const outputPath = './exports/users_cleaned.json';
    
    await cleanUsersJson(inputPath, outputPath);
    
    console.log('\n✨ Users JSON cleaning completed successfully!');
    console.log('📁 Check the ./exports/users_cleaned.json file for your cleaned data.');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export { cleanUsersJson };
