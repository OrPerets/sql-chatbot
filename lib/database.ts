import { MongoClient, Db, ServerApiVersion } from 'mongodb';

// Database connection configuration
const MONGODB_URI = process.env.MONGODB_URI || `mongodb+srv://${process.env.DB_USERNAME || 'sql-admin'}:${process.env.DB_PASSWORD || 'SMff5PqhhoVbX6z7'}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
const DB_NAME = process.env.DB_NAME || 'experiment';

// Use globalThis for Vercel serverless - persists across function invocations
// This is critical for serverless environments where module-level variables don't persist
declare global {
  var _mongoClient: MongoClient | undefined;
  var _mongoDb: Db | undefined;
  var _mongoConnectionAttempts: number | undefined;
  var _mongoClientInstanceCount: number | undefined;
  var _mongoTotalConnectionsCreated: number | undefined;
}

const maxConnectionAttempts = 3;

// Connection statistics tracking (using globalThis for serverless)
const getClientInstanceCount = () => {
  if (typeof globalThis._mongoClientInstanceCount === 'undefined') {
    globalThis._mongoClientInstanceCount = 0;
  }
  return globalThis._mongoClientInstanceCount;
};

const getTotalConnectionsCreated = () => {
  if (typeof globalThis._mongoTotalConnectionsCreated === 'undefined') {
    globalThis._mongoTotalConnectionsCreated = 0;
  }
  return globalThis._mongoTotalConnectionsCreated;
};


const POOL_CONFIG = {
  minPoolSize: Number(process.env.DB_MIN_POOL_SIZE ?? 10), // Maintain warm connections for faster response
  maxPoolSize: Number(process.env.DB_MAX_POOL_SIZE ?? 40), // Increased to 40: M0 supports 500 total, safe for ~12 concurrent instances
};

/**
 * Get connection pool statistics (if available)
 */
async function getConnectionPoolStats(client: MongoClient): Promise<{
  active: number;
  idle: number;
  total: number;
  maxPoolSize: number;
} | null> {
  try {
    // MongoDB driver doesn't expose pool stats directly, but we can track our own metrics
    // The actual pool management is handled by the driver internally
    return {
      active: 0, // Not directly available from driver
      idle: 0, // Not directly available from driver
      total: 0, // Not directly available from driver
      maxPoolSize: POOL_CONFIG.maxPoolSize,
    };
  } catch {
    return null;
  }
}

/**
 * Log connection pool statistics and warn if approaching limits
 */
async function logConnectionStats(client: MongoClient): Promise<void> {
  try {
    const stats = await getConnectionPoolStats(client);
    if (stats) {
      const usagePercent = stats.total > 0 
        ? Math.round((stats.total / stats.maxPoolSize) * 100) 
        : 0;
      
      if (usagePercent > 80) {
        console.warn(
          `⚠️ MongoDB connection pool usage high: ${usagePercent}% (${stats.total}/${stats.maxPoolSize})`
        );
      } else {
        console.log(
          `📊 MongoDB connection pool: max=${stats.maxPoolSize}, instances=${getClientInstanceCount()}, total_created=${getTotalConnectionsCreated()}`
        );
      }
    }
  } catch (error) {
    // Silently fail - stats are optional
  }
}

/**
 * MongoDB Connection Manager for Vercel Serverless Environment
 * Uses singleton pattern with connection caching for optimal performance
 */
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // Use globalThis for Vercel serverless - this persists across function invocations
  // Check if we have a cached connection and it's still connected, reuse it
  if (globalThis._mongoClient && globalThis._mongoDb) {
    try {
      // Test the connection with a simple ping (with timeout)
      await Promise.race([
        globalThis._mongoDb.admin().ping(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ping timeout')), 5000)
        )
      ]);
      console.log('♻️ Reusing existing MongoDB connection (from globalThis)');
      await logConnectionStats(globalThis._mongoClient);
      return { client: globalThis._mongoClient, db: globalThis._mongoDb };
    } catch (error) {
      console.log('🔄 Cached connection failed, creating new connection...', error);
      // Clear cached connection if ping fails
      globalThis._mongoClient = undefined;
      globalThis._mongoDb = undefined;
    }
  }

  // Initialize connection attempts counter
  if (typeof globalThis._mongoConnectionAttempts === 'undefined') {
    globalThis._mongoConnectionAttempts = 0;
  }

  while (globalThis._mongoConnectionAttempts < maxConnectionAttempts) {
    try {
      globalThis._mongoConnectionAttempts++;
      console.log(`🔌 Creating new MongoDB connection (attempt ${globalThis._mongoConnectionAttempts}/${maxConnectionAttempts})...`);
      
      // Warn if creating multiple client instances (this should be rare with globalThis)
      const instanceCount = getClientInstanceCount();
      if (instanceCount > 0) {
        console.warn(
          `⚠️ Creating new MongoClient instance (${instanceCount + 1} total). This may indicate connection leaks!`
        );
        console.warn('💡 In Vercel serverless, this usually means the execution context was reset.');
      }
      
      // Create new client with optimized settings for M0 cluster
      const client = new MongoClient(MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        maxPoolSize: POOL_CONFIG.maxPoolSize,
        minPoolSize: POOL_CONFIG.minPoolSize,
        maxIdleTimeMS: 30000, // Close idle connections after 30s
        connectTimeoutMS: 30000, // Increased from 10s to 30s for SSL handshake
        serverSelectionTimeoutMS: 30000, // Increased from 15s to 30s
        socketTimeoutMS: 45000, // Socket timeout
        heartbeatFrequencyMS: 60000, // Less frequent heartbeats
        waitQueueTimeoutMS: 5000, // Wait max 5s for connection from pool (prevents long waits)
        // Retry configuration (TLS is automatically enabled for mongodb+srv://)
        retryWrites: true,
        retryReads: true,
      });

      await client.connect();
      const db = client.db(DB_NAME);
      await db.command({ ping: 1 });
      
      // Track statistics
      globalThis._mongoClientInstanceCount = (globalThis._mongoClientInstanceCount || 0) + 1;
      globalThis._mongoTotalConnectionsCreated = (globalThis._mongoTotalConnectionsCreated || 0) + 1;
      
      console.log(
        `✅ Successfully connected to MongoDB! (pool: min=${POOL_CONFIG.minPoolSize}, max=${POOL_CONFIG.maxPoolSize}, instances=${getClientInstanceCount()})`
      );
      
      // Cache the connection in globalThis (persists across serverless invocations)
      globalThis._mongoClient = client;
      globalThis._mongoDb = db;
      globalThis._mongoConnectionAttempts = 0; // Reset on successful connection
      
      await logConnectionStats(client);
      
      return { client: globalThis._mongoClient, db: globalThis._mongoDb };
      
    } catch (error: any) {
      // connectionAttempts already incremented above
      
      // Check if this is an SSL/TLS error
      const isSSLError = error?.code === 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' ||
                        error?.message?.includes('SSL') ||
                        error?.message?.includes('TLS') ||
                        error?.cause?.code === 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR';
      
      if (isSSLError) {
        console.error(
          `❌ MongoDB SSL/TLS connection error (attempt ${globalThis._mongoConnectionAttempts}/${maxConnectionAttempts}):`,
          error?.cause?.message || error?.message || 'Unknown SSL error'
        );
        console.log('💡 This may be a transient network issue. Retrying with longer delay...');
      } else {
        console.error(`❌ MongoDB connection attempt ${globalThis._mongoConnectionAttempts} failed:`, error);
      }
      
      if (globalThis._mongoConnectionAttempts >= maxConnectionAttempts) {
        console.error(`❌ Failed to connect after ${maxConnectionAttempts} attempts`);
        if (isSSLError) {
          console.error('💡 SSL/TLS errors often indicate:');
          console.error('   1. Network connectivity issues');
          console.error('   2. Firewall blocking MongoDB Atlas');
          console.error('   3. IP address not whitelisted in MongoDB Atlas');
          console.error('   4. Transient MongoDB Atlas service issues');
        }
        // Reset attempts counter for next try
        globalThis._mongoConnectionAttempts = 0;
        throw error;
      }
      
      // Wait before retrying (exponential backoff, longer delay for SSL errors)
      const delay = isSSLError 
        ? 3000 * globalThis._mongoConnectionAttempts // 3s, 6s, 9s for SSL errors
        : 1000 * globalThis._mongoConnectionAttempts; // 1s, 2s, 3s for other errors
      await new Promise(resolve => setTimeout(resolve, delay));
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
        globalThis._mongoClient = undefined;
        globalThis._mongoDb = undefined;
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
  QUESTION_TEMPLATES: 'question_templates',
  INSTANTIATED_QUESTIONS: 'instantiated_questions',
  ANALYSIS_RESULTS: 'analysis_results',
  QUESTION_ANALYTICS: 'question_analytics',
  // Consolidated mentor-server collections
  USERS: 'users',
  CHAT_SESSIONS: 'chatSessions',
  CHAT_MESSAGES: 'chatMessages',
  COINS: 'Coins',
  USER_POINTS: 'userPoints',
  FEEDBACKS: 'Feedbacks',
  USER_FORMS: 'UserForms',
  STATUS: 'Status',
  COINS_STATUS: 'CoinsStatus',
  PRACTICE_TABLES: 'practiceTables',
  PRACTICE_QUERIES: 'practiceQueries',
  PRACTICE_ATTEMPTS: 'practiceAttempts',
  WEEKLY_CONTENT: 'weekly_content',
  SEMESTER_CONFIG: 'semester_config',
  NOTIFICATIONS: 'notifications',
  PASSWORD_RESET_TOKENS: 'password_reset_tokens',
  // Sprint 2: Student Profiles Management System
  STUDENT_PROFILES: 'student_profiles',
  STUDENT_ACTIVITIES: 'student_activities',
  CONVERSATION_SUMMARIES: 'conversation_summaries',
  // Security collections
  RATE_LIMITS: 'rate_limits',
  IP_RATE_LIMITS: 'ip_rate_limits',
  SECURITY_EVENTS: 'security_events',
} as const;
