/**
 * Utility to ensure database indexes exist
 * Can be called on application startup or as needed
 */

import { connectToDatabase, COLLECTIONS } from './database';
import { DATABASE_INDEXES } from './models';

/**
 * Ensure all database indexes are created
 * Safe to call multiple times - will skip existing indexes
 */
export async function ensureIndexes(): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    const indexDefinitions = DATABASE_INDEXES as Record<string, readonly any[]>;
    
    for (const [collectionKey, indexes] of Object.entries(indexDefinitions)) {
      const collectionName = COLLECTIONS[collectionKey as keyof typeof COLLECTIONS];
      
      if (!collectionName || !Array.isArray(indexes) || indexes.length === 0) {
        continue;
      }
      
      const collection = db.collection(collectionName);
      
      for (const index of indexes) {
        try {
          // Create index in background (non-blocking)
          await collection.createIndex(index, { background: true });
        } catch (error: any) {
          // Index already exists or conflict - that's fine
          if (error.code !== 85 && error.codeName !== 'IndexOptionsConflict') {
            console.warn(`Failed to create index on ${collectionName}:`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error ensuring indexes:', error);
    // Don't throw - indexes are optional for app to function
  }
}
