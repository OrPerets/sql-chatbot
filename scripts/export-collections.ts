#!/usr/bin/env ts-node

import { MongoClient, Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { connectToDatabase, COLLECTIONS } from '../lib/database.js';

/**
 * Export MongoDB collections to local JSON files
 * Exports: UserForms, chatMessages, chatSessions
 */

interface ExportOptions {
  outputDir?: string;
  prettyPrint?: boolean;
  includeMetadata?: boolean;
}

class CollectionExporter {
  private db: Db;
  private outputDir: string;

  constructor(db: Db, outputDir: string = './exports') {
    this.db = db;
    this.outputDir = outputDir;
    
    // Create output directory if it doesn't exist
    try {
      fs.mkdirSync(this.outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${this.outputDir}`);
    } catch (error) {
      console.log(`📁 Using existing output directory: ${this.outputDir}`);
    }
  }

  /**
   * Convert MongoDB ObjectId and Date objects to serializable format
   */
  private serializeDocument(doc: any): any {
    if (!doc) return doc;
    
    const serialized = JSON.parse(JSON.stringify(doc, (key, value) => {
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
    
    return serialized;
  }

  /**
   * Export a single collection to JSON file
   */
  async exportCollection(collectionName: string, options: ExportOptions = {}): Promise<void> {
    const { prettyPrint = true, includeMetadata = true } = options;
    
    console.log(`🔄 Exporting collection: ${collectionName}`);
    
    try {
      // Get all documents from the collection
      const documents = await this.db.collection(collectionName).find({}).toArray();
      console.log(`📊 Found ${documents.length} documents in ${collectionName}`);
      
      // Serialize documents
      const serializedDocs = documents.map(doc => this.serializeDocument(doc));
      
      // Create export data with metadata
      const exportData = includeMetadata ? {
        collection: collectionName,
        exportDate: new Date().toISOString(),
        documentCount: documents.length,
        documents: serializedDocs
      } : serializedDocs;
      
      // Write to file
      const filename = `${collectionName}.json`;
      const filepath = path.join(this.outputDir, filename);
      const jsonString = prettyPrint 
        ? JSON.stringify(exportData, null, 2)
        : JSON.stringify(exportData);
      
      fs.writeFileSync(filepath, jsonString, 'utf8');
      console.log(`✅ Exported ${collectionName} to: ${filepath}`);
      
    } catch (error) {
      console.error(`❌ Error exporting ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Export multiple collections
   */
  async exportCollections(collectionNames: string[], options: ExportOptions = {}): Promise<void> {
    console.log(`🚀 Starting export of ${collectionNames.length} collections...`);
    
    for (const collectionName of collectionNames) {
      try {
        await this.exportCollection(collectionName, options);
      } catch (error) {
        console.error(`Failed to export ${collectionName}, continuing with other collections...`);
      }
    }
    
    console.log(`🎉 Export completed! Check the ${this.outputDir} directory for results.`);
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(collectionName: string): Promise<any> {
    try {
      const count = await this.db.collection(collectionName).countDocuments();
      const sample = await this.db.collection(collectionName).findOne();
      
      return {
        name: collectionName,
        documentCount: count,
        sampleDocument: sample ? Object.keys(sample) : [],
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
}

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  
  try {
    const { db } = await connectToDatabase();
    console.log('✅ Connected to database successfully!');
    
    // Create exporter
    const exporter = new CollectionExporter(db, './exports');
    
    // Define collections to export
    const collectionsToExport = [
      COLLECTIONS.USER_FORMS,
      COLLECTIONS.CHAT_MESSAGES,
      COLLECTIONS.CHAT_SESSIONS
    ];
    
    // Get collection statistics first
    console.log('\n📊 Collection Statistics:');
    for (const collectionName of collectionsToExport) {
      const stats = await exporter.getCollectionStats(collectionName);
      console.log(`  ${stats.name}: ${stats.documentCount} documents ${stats.hasData ? '✅' : '❌'}`);
      if (stats.sampleDocument && stats.sampleDocument.length > 0) {
        console.log(`    Sample fields: ${stats.sampleDocument.slice(0, 5).join(', ')}${stats.sampleDocument.length > 5 ? '...' : ''}`);
      }
    }
    
    // Export collections
    console.log('\n🚀 Starting export process...');
    await exporter.exportCollections(collectionsToExport, {
      prettyPrint: true,
      includeMetadata: true
    });
    
    console.log('\n✨ Export completed successfully!');
    console.log('📁 Check the ./exports directory for your JSON files:');
    collectionsToExport.forEach(name => {
      console.log(`  - ${name}.json`);
    });
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

export { CollectionExporter };
