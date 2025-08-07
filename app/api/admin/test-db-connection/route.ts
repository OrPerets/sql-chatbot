import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection URL - using the same credentials as mentor server
const DB_USERNAME = process.env.dbUserName || "sql-admin";
const DB_PASSWORD = process.env.dbPassword || "SMff5PqhhoVbX6z7";
const MONGO_URL = process.env.MONGODB_URI || `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing database connection...');
    console.log('🔧 Environment variables:');
    console.log('  - DB_USERNAME:', DB_USERNAME);
    console.log('  - DB_PASSWORD length:', DB_PASSWORD.length);
    console.log('  - MONGO_URL (masked):', MONGO_URL.replace(DB_PASSWORD, '***'));
    
    // Connect to MongoDB with detailed logging
    const client = new MongoClient(MONGO_URL, {
      connectTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
      maxPoolSize: 1,
      retryWrites: true,
    });
    
    console.log('🔌 Attempting to connect...');
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');
    
    // Test accessing the experiment database
    const experimentDb = client.db("experiment");
    console.log('📊 Accessing experiment database...');
    
    // Test basic queries
    const finalExamsCount = await experimentDb.collection("finalExams").countDocuments({ status: 'completed' });
    const questionsCount = await experimentDb.collection("questions").countDocuments();
    
    console.log(`📊 Found ${finalExamsCount} completed exams`);
    console.log(`📊 Found ${questionsCount} questions`);
    
    await client.close();
    console.log('✅ Database connection test completed');
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      data: {
        finalExamsCount,
        questionsCount,
        database: 'experiment',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Database connection failed',
      details: {
        name: error.name,
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}