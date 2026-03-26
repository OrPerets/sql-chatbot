#!/usr/bin/env ts-node

import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extract users from Excel file and merge with existing users.json
 */

interface ExcelUser {
  [key: string]: any;
}

interface UserDocument {
  _id?: string;
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  isFirst?: boolean;
  class?: string;
  [key: string]: any;
}

interface UsersExport {
  collection: string;
  exportDate: string;
  documentCount: number;
  documents: UserDocument[];
}

async function extractUsersFromExcel(excelPath: string): Promise<ExcelUser[]> {
  console.log(`📖 Reading Excel file: ${excelPath}`);
  
  try {
    // Read the Excel file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);

    // Get the first sheet
    const firstSheet = workbook.worksheets[0];
    const sheetName = firstSheet?.name;
    if (!firstSheet || !sheetName) {
      throw new Error('Excel file does not contain any worksheets');
    }
    console.log(`📊 Using sheet: ${sheetName}`);

    // Convert to JSON-like objects using header row
    const headerRow = firstSheet.getRow(1);
    const headers = headerRow.values
      .slice(1)
      .map((value) => String(value ?? '').trim());

    const jsonData: ExcelUser[] = [];
    firstSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowValues = row.values as any[];
      const record: ExcelUser = {};
      let hasData = false;
      headers.forEach((header, index) => {
        if (!header) return;
        const cellValue = rowValues[index + 1];
        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
          hasData = true;
        }
        record[header] = cellValue;
      });
      if (hasData) {
        jsonData.push(record);
      }
    });
    console.log(`📋 Found ${jsonData.length} rows in Excel file`);
    
    // Display the first few rows to understand structure
    if (jsonData.length > 0) {
      console.log('\n📝 Sample Excel data structure:');
      const sample = jsonData[0] as ExcelUser;
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        const preview = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : String(value);
        console.log(`  ${key}: ${type} = ${preview}`);
      });
    }
    
    return jsonData as ExcelUser[];
    
  } catch (error) {
    console.error('❌ Error reading Excel file:', error);
    throw error;
  }
}

function convertExcelToUser(excelUser: ExcelUser, index: number): UserDocument {
  // Map Excel columns to user document structure
  // This mapping might need adjustment based on actual Excel structure
  
  const user: UserDocument = {
    _id: `excel_${Date.now()}_${index}`, // Generate unique ID
    email: '', // Will be populated from Excel data
    isFirst: true, // Default value
  };
  
  // Try to map common field names (case insensitive)
  const fieldMappings: { [key: string]: string } = {
    'email': 'email',
    'אימייל': 'email',
    'mail': 'email',
    'firstname': 'firstName',
    'first name': 'firstName',
    'שם פרטי': 'firstName',
    'שם_פרטי': 'firstName',
    'lastname': 'lastName',
    'last name': 'lastName',
    'שם משפחה': 'lastName',
    'שם_משפחה': 'lastName',
    'password': 'password',
    'סיסמה': 'password',
    'class': 'class',
    'כיתה': 'class',
    'classid': 'class',
    'class_id': 'class',
  };
  
  // Process each field from Excel
  Object.keys(excelUser).forEach(excelKey => {
    const value = excelUser[excelKey];
    
    // Skip empty values
    if (value === null || value === undefined || value === '') {
      return;
    }
    
    // Find matching field mapping
    const normalizedKey = excelKey.toLowerCase().trim();
    let mappedField = fieldMappings[normalizedKey];
    
    // If no direct mapping found, try partial matching
    if (!mappedField) {
      for (const [pattern, field] of Object.entries(fieldMappings)) {
        if (normalizedKey.includes(pattern) || pattern.includes(normalizedKey)) {
          mappedField = field;
          break;
        }
      }
    }
    
    // Set the field value
    if (mappedField) {
      user[mappedField] = value;
    } else {
      // Keep unmapped fields as-is
      user[excelKey] = value;
    }
  });
  
  // Ensure required fields have default values
  if (!user.email) {
    console.warn(`⚠️ Row ${index + 1}: No email found, skipping`);
    return null;
  }
  
  if (!user.firstName) {
    user.firstName = 'Unknown';
  }
  
  if (!user.lastName) {
    user.lastName = '';
  }
  
  if (!user.password) {
    user.password = 'default123'; // Default password
  }
  
  return user;
}

async function mergeWithExistingUsers(excelUsers: UserDocument[], usersJsonPath: string): Promise<void> {
  console.log(`🔄 Merging with existing users from: ${usersJsonPath}`);
  
  let existingData: UsersExport;
  
  // Read existing users.json
  try {
    const existingContent = fs.readFileSync(usersJsonPath, 'utf8');
    existingData = JSON.parse(existingContent);
    console.log(`📊 Found ${existingData.documents.length} existing users`);
  } catch (error) {
    console.log('📝 No existing users file found, creating new one');
    existingData = {
      collection: 'users',
      exportDate: new Date().toISOString(),
      documentCount: 0,
      documents: []
    };
  }
  
  // Filter out null users and check for duplicates
  const validExcelUsers = excelUsers.filter(user => user !== null);
  const existingEmails = new Set(existingData.documents.map(user => user.email.toLowerCase()));
  
  const newUsers = validExcelUsers.filter(user => 
    !existingEmails.has(user.email.toLowerCase())
  );
  
  console.log(`✅ ${validExcelUsers.length} valid users from Excel`);
  console.log(`🆕 ${newUsers.length} new users to add (${validExcelUsers.length - newUsers.length} duplicates skipped)`);
  
  // Merge the data
  const mergedDocuments = [...existingData.documents, ...newUsers];
  
  const mergedData: UsersExport = {
    collection: 'users',
    exportDate: new Date().toISOString(),
    documentCount: mergedDocuments.length,
    documents: mergedDocuments
  };
  
  // Write back to file
  const outputPath = path.join(path.dirname(usersJsonPath), 'users_merged.json');
  fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf8');
  
  console.log(`✅ Merged users saved to: ${outputPath}`);
  console.log(`📊 Total users: ${mergedData.documentCount} (${existingData.documents.length} existing + ${newUsers.length} new)`);
  
  // Also update the original file
  fs.writeFileSync(usersJsonPath, JSON.stringify(mergedData, null, 2), 'utf8');
  console.log(`✅ Original users.json updated`);
}

async function main() {
  try {
    const excelPath = './users_to_add.xlsx';
    const usersJsonPath = './exports/users.json';
    
    // Extract users from Excel
    const excelUsers = await extractUsersFromExcel(excelPath);
    
    // Convert to user format
    console.log('\n🔄 Converting Excel data to user format...');
    const convertedUsers = excelUsers
      .map((user, index) => convertExcelToUser(user, index))
      .filter(user => user !== null);
    
    console.log(`✅ Converted ${convertedUsers.length} users`);
    
    // Show sample converted user
    if (convertedUsers.length > 0) {
      console.log('\n👤 Sample converted user:');
      const sample = convertedUsers[0];
      Object.entries(sample).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }
    
    // Merge with existing users
    await mergeWithExistingUsers(convertedUsers, usersJsonPath);
    
    console.log('\n✨ Excel import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export { extractUsersFromExcel, convertExcelToUser, mergeWithExistingUsers };
