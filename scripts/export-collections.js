#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const MONGODB_URI = process.env.MONGODB_URI || `mongodb+srv://${process.env.DB_USERNAME || 'sql-admin'}:${process.env.DB_PASSWORD || 'SMff5PqhhoVbX6z7'}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DB_NAME = process.env.DB_NAME || 'experiment';

// Collection names to export
const COLLECTIONS_TO_EXPORT = [
  'UserForms',
  'chatMessages', 
  'chatSessions'
];

/**
 * Convert MongoDB ObjectId and Date objects to serializable format
 */
function serializeDocument(doc) {
  if (!doc) return doc;
  
  return JSON.parse(JSON.stringify(doc, (key, value) => {
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
}

/**
 * Export a single collection to JSON file
 */
async function exportCollection(db, collectionName, outputDir) {
  console.log(`🔄 Exporting collection: ${collectionName}`);
  
  try {
    // Get all documents from the collection
    const documents = await db.collection(collectionName).find({}).toArray();
    console.log(`📊 Found ${documents.length} documents in ${collectionName}`);
    
    // Serialize documents
    const serializedDocs = documents.map(doc => serializeDocument(doc));
    
    // Create export data with metadata
    const exportData = {
      collection: collectionName,
      exportDate: new Date().toISOString(),
      documentCount: documents.length,
      documents: serializedDocs
    };
    
    // Write to file
    const filename = `${collectionName}.json`;
    const filepath = path.join(outputDir, filename);
    const jsonString = JSON.stringify(exportData, null, 2);
    
    fs.writeFileSync(filepath, jsonString, 'utf8');
    console.log(`✅ Exported ${collectionName} to: ${filepath}`);
    
    return {
      collection: collectionName,
      documentCount: documents.length,
      filepath: filepath
    };
    
  } catch (error) {
    console.error(`❌ Error exporting ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Get collection statistics
 */
async function getCollectionStats(db, collectionName) {
  try {
    const count = await db.collection(collectionName).countDocuments();
    const sample = await db.collection(collectionName).findOne();
    
    return {
      name: collectionName,
      documentCount: count,
      sampleFields: sample ? Object.keys(sample) : [],
      hasData: count > 0
    };
  } catch (error) {
    return {
      name: collectionName,
      error: error.message,
      hasData: false
    };
  }
}

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  
  let client;
  try {
    // Create MongoDB client
    client = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 15000,
      heartbeatFrequencyMS: 60000,
      minPoolSize: 0,
    });

    await client.connect();
    const db = client.db(DB_NAME);
    await db.command({ ping: 1 });
    console.log('✅ Connected to database successfully!');
    
    // Create output directory
    const outputDir = './exports';
    try {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    } catch (error) {
      console.log(`📁 Using existing output directory: ${outputDir}`);
    }
    
    // Get collection statistics first
    console.log('\n📊 Collection Statistics:');
    for (const collectionName of COLLECTIONS_TO_EXPORT) {
      const stats = await getCollectionStats(db, collectionName);
      console.log(`  ${stats.name}: ${stats.documentCount} documents ${stats.hasData ? '✅' : '❌'}`);
      if (stats.sampleFields && stats.sampleFields.length > 0) {
        console.log(`    Sample fields: ${stats.sampleFields.slice(0, 5).join(', ')}${stats.sampleFields.length > 5 ? '...' : ''}`);
      }
    }
    
    // Export collections
    console.log('\n🚀 Starting export process...');
    const results = [];
    
    for (const collectionName of COLLECTIONS_TO_EXPORT) {
      try {
        const result = await exportCollection(db, collectionName, outputDir);
        results.push(result);
      } catch (error) {
        console.error(`Failed to export ${collectionName}, continuing with other collections...`);
      }
    }
    
    console.log('\n🎉 Export completed successfully!');
    console.log('📁 Check the ./exports directory for your JSON files:');
    results.forEach(result => {
      console.log(`  - ${result.collection}.json (${result.documentCount} documents)`);
    });
    
    // Summary
    const totalDocuments = results.reduce((sum, result) => sum + result.documentCount, 0);
    console.log(`\n📈 Total documents exported: ${totalDocuments}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { exportCollection, getCollectionStats };
