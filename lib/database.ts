import { MongoClient, Db, ServerApiVersion } from 'mongodb';

// Database connection configuration
const MONGODB_URI = process.env.MONGODB_URI || `mongodb+srv://${process.env.DB_USERNAME || 'sql-admin'}:${process.env.DB_PASSWORD || 'SMff5PqhhoVbX6z7'}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DB_NAME = process.env.DB_NAME || 'experiment';

// Global variables for connection caching (Vercel serverless optimization)
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let connectionAttempts = 0;
const maxConnectionAttempts = 3;

/**
 * MongoDB Connection Manager for Vercel Serverless Environment
 * Uses singleton pattern with connection caching for optimal performance
 */
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // If we have a cached connection and it's still connected, reuse it
  if (cachedClient && cachedDb) {
    try {
      // Test the connection with a simple ping
      await cachedDb.admin().ping();
      console.log('♻️ Reusing existing MongoDB connection');
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      console.log('🔄 Cached connection failed, creating new connection...');
      // Clear cached connection if ping fails
      cachedClient = null;
      cachedDb = null;
    }
  }

  while (connectionAttempts < maxConnectionAttempts) {
    try {
      console.log(`🔌 Creating new MongoDB connection (attempt ${connectionAttempts + 1})...`);
      
      // Create new client with minimal, stable settings for Vercel
      const client = new MongoClient(MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        maxPoolSize: 1, // Use single connection to avoid pool issues
        serverSelectionTimeoutMS: 15000, // Increased timeout
        heartbeatFrequencyMS: 60000, // Less frequent heartbeats
        minPoolSize: 0, // Allow pool to shrink to 0
      });

      await client.connect();
      const db = client.db(DB_NAME);
      await db.command({ ping: 1 });
      
      console.log("✅ Successfully connected to MongoDB!");
      
      // Cache the connection
      cachedClient = client;
      cachedDb = db;
      connectionAttempts = 0; // Reset on successful connection
      
      return { client: cachedClient, db: cachedDb };
      
    } catch (error) {
      connectionAttempts++;
      console.error(`❌ MongoDB connection attempt ${connectionAttempts} failed:`, error);
      
      if (connectionAttempts >= maxConnectionAttempts) {
        console.error(`❌ Failed to connect after ${maxConnectionAttempts} attempts`);
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * connectionAttempts));
    }
  }

  throw new Error('Failed to establish database connection');
}

/**
 * Helper function to execute database operations with automatic recovery from pool errors
 */
export async function executeWithRetry<T>(
  operation: (db: Db) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { db } = await connectToDatabase();
      return await operation(db);
    } catch (error: any) {
      console.error(`Database operation attempt ${attempt} failed:`, error);
      
      // If it's a connection error and we have retries left, reset the connection
      if (attempt < maxRetries && (
        error.message?.includes('pool') ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout')
      )) {
        cachedClient = null;
        cachedDb = null;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Database operation failed after all retries');
}

/**
 * Database collection names
 */
export const COLLECTIONS = {
  DATASETS: 'datasets',
  HOMEWORK_SETS: 'homework_sets',
  QUESTIONS: 'questions',
  SUBMISSIONS: 'submissions',
  ANALYTICS: 'analytics_events',
  AUDIT_LOGS: 'audit_logs',
} as const;
