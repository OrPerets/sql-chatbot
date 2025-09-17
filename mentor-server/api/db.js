// MongoDB Connection Manager for Vercel Serverless Environment
var MongoClient = require('mongodb').MongoClient;
var ServerApiVersion = require('mongodb').ServerApiVersion;
var config = require('./config');

const remoteDbPassword = config.dbPassword;
const dbUserName = config.dbUserName;
const connectionString = `mongodb+srv://${dbUserName}:${remoteDbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;

// Global variables for connection caching
let cachedClient = null;
let cachedDb = null;
let connectionAttempts = 0;
const maxConnectionAttempts = 3;

// Connection manager - singleton pattern for Vercel serverless
async function connectToDatabase() {
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
            const client = new MongoClient(connectionString, {
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
            await client.db("experiment").command({ ping: 1 });
            
            console.log("✅ Successfully connected to MongoDB!");
            
            // Cache the connection
            cachedClient = client;
            cachedDb = client.db("experiment");
            connectionAttempts = 0; // Reset on successful connection
            
            return { client: cachedClient, db: cachedDb };
            
        } catch (error) {
            connectionAttempts++;
            console.error(`❌ MongoDB connection attempt ${connectionAttempts} failed:`, error.message);
            
            if (connectionAttempts >= maxConnectionAttempts) {
                console.error(`❌ Failed to connect after ${maxConnectionAttempts} attempts`);
                throw error;
            }
            
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * connectionAttempts));
        }
    }
}

// Helper function to execute database operations with automatic recovery from pool errors
async function executeWithRetry(operation, operationName = 'Database operation') {
    const maxRetries = 2;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await operation();
            return result;
        } catch (error) {
            lastError = error;
            console.error(`${operationName} failed (attempt ${attempt + 1}):`, error.message);
            
            // Check if it's a pool clearing error or connection error
            if (error.name === 'MongoPoolClearedError' || 
                error.name === 'MongoNetworkError' || 
                error.message.includes('SSL routines') ||
                error.message.includes('connection pool')) {
                
                console.log('🔄 Pool/connection error detected, clearing cache and retrying...');
                // Clear the cached connection
                cachedClient = null;
                cachedDb = null;
                connectionAttempts = 0;
                
                // Don't retry on the last attempt
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
            }
            
            // For non-connection errors or last attempt, throw immediately
            throw error;
        }
    }
    
    throw lastError;
}

// Helper function to get database instance with automatic recovery
async function getDatabase() {
    try {
        const { db } = await connectToDatabase();
        return db;
    } catch (error) {
        console.error('Database connection failed, clearing cache and retrying...');
        // Clear cache and try once more
        cachedClient = null;
        cachedDb = null;
        connectionAttempts = 0;
        
        const { db } = await connectToDatabase();
        return db;
    }
}

module.exports = {
    getDatabase: getDatabase, // Export for debugging
    connectToDb: async () => {
        try {
            await connectToDatabase();
            console.log('✅ Connected to mongo!!!');
        } catch (err) {
            console.log(`❌ Could not connect to MongoDB (err) => ${err}`);
        }
    },
    
    connection: connectionString,
    
    getDb: async () => {
        const db = await getDatabase();
        return db;
    },
    
    getStatus: async () => {
        const db = await getDatabase();
        const status = await db.collection("Status").find({}).toArray();
        return {
            "status": status[0]["status"]
        };
    },
    
    setStatus: async (val) => {
        const db = await getDatabase();
        const status = await db.collection("Status").updateOne(
            { sid: "admin" },
            { $set: { status: val } }
        );
        return status;
    },
    
    getCoinsStatus: async () => {
        const db = await getDatabase();
        const status = await db.collection("CoinsStatus").find({}).toArray();
        return {
            "status": status[0]["status"]
        };
    },
    
    setCoinsStatus: async (val) => {
        const db = await getDatabase();
        const status = await db.collection("CoinsStatus").updateOne(
            { sid: "admin" },
            { $set: { status: val } }
        );
        return status;
    },
    
    addItem: async (item) => {
        const db = await getDatabase();
        const collection = db.collection("winter");
        await collection.insertOne(item);
        return 200;
    },
    
    updatePassword: async (emails, newPassword) => {
        const db = await getDatabase();
        const collection = db.collection("users");
        await collection.updateMany(
            { email: { $in: emails } }, 
            { $set: { password: newPassword } }
        );
        return 200;
    },
    
    getAllUsers: async () => {
        const db = await getDatabase();
        const collection = db.collection("users");
        return collection.find({}).toArray();
    },
    
    getChatSessions: async (userId) => {
        const db = await getDatabase();
        const sessions = await db.collection("chatSessions").find({ userId }).toArray();
        return sessions;
    },

    createChatSession: async (userId, title) => {
        const session = {
            userId,
            title,
            createdAt: new Date(),
            lastMessageTimestamp: new Date()
        };
        const db = await getDatabase();
        const result = await db.collection("chatSessions").insertOne(session);
        return { id: result.insertedId, ...session };
    },
    
    getCoinsBalance: async (userEmail) => {
        const db = await getDatabase();
        const messages = await db.collection("Coins").find({user: userEmail}).toArray();
        return messages;
    },
    
    getAllCoins: async () => {
        const db = await getDatabase();
        const coins = await db.collection("Coins").find({}).toArray();
        return coins;
    },

    setCoinsBalance: async (user, currentBalance) => {
        const db = await getDatabase();
        const result = await db.collection("Coins").updateOne(
            { user: user },
            { $set: { coins: currentBalance } },
            { upsert: true }
        );
        return result;
    },
    
    updateCoinsBalance: async (users, amount) => {
        const db = await getDatabase();
        const result = await db.collection("Coins").updateMany(
            { user: { $in: users } },
            { $inc: { coins: amount } }
        );
        return result;
    },
    
    getChatMessages: async (chatId) => {
        const db = await getDatabase();
        const messages = await db.collection("chatMessages").find({ chatId }).toArray();
        return messages;
    },
    
    saveFeedback: async (feedbackObj) => {
        const db = await getDatabase();
        const result = await db.collection("Feedbacks").insertOne(feedbackObj);
        return { id: result.insertedId };
    },
    
    saveChatMessage: async (chatId, role, text) => {
        const message = {
            chatId,
            role,
            text,
            timestamp: new Date()
        };
        const db = await getDatabase();
        await db.collection("chatMessages").insertOne(message);
        await db.collection("chatSessions").updateOne(
            { _id: chatId },
            { $set: { lastMessageTimestamp: new Date() } }
        );
        return message;
    },
    
    saveUserForm: async (data) => {
        const db = await getDatabase();
        try {
            const result = await db.collection("UserForms").insertOne(data);
            return { "status": 1 };
        } catch {
            return { "status": 0 };
        }
    },

    // Exercise-related functions
    getUserPoints: async (userId) => {
        const db = await getDatabase();
        const userPoints = await db.collection("userPoints").findOne({ userId });
        return userPoints || { userId, points: 0, answeredExercises: [], failedAttempts: {} };
    },

    updateUserPoints: async (userId, pointsToAdd, exerciseId) => {
        const db = await getDatabase();
        const result = await db.collection("userPoints").updateOne(
            { userId },
            { 
                $inc: { points: pointsToAdd },
                $addToSet: { answeredExercises: exerciseId },
                $set: { lastUpdated: new Date() }
            },
            { upsert: true }
        );
        return result;
    },

    addFailedAttempt: async (userId, exerciseId) => {
        const db = await getDatabase();
        const result = await db.collection("userPoints").updateOne(
            { userId },
            { 
                $inc: { [`failedAttempts.${exerciseId}`]: 1 },
                $set: { lastUpdated: new Date() }
            },
            { upsert: true }
        );
        return result;
    },

    getFailedAttempts: async (userId, exerciseId) => {
        const db = await getDatabase();
        const userPoints = await db.collection("userPoints").findOne({ userId });
        return userPoints?.failedAttempts?.[exerciseId] || 0;
    },

    getAvailableExercises: async (userId) => {
        const db = await getDatabase();
        const userPoints = await db.collection("userPoints").findOne({ userId });
        const answeredExercises = userPoints?.answeredExercises || [];
        
        // Return exercise IDs that haven't been answered yet
        const exercises = await db.collection("questions").find({}).toArray();
        return exercises.filter(exercise => !answeredExercises.includes(exercise.id));
    }
};
