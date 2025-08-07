import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import * as XLSX from 'xlsx';

// MongoDB connection URL - using the same credentials as mentor server
const DB_USERNAME = process.env.dbUserName || "sql-admin";
const DB_PASSWORD = process.env.dbPassword || "SMff5PqhhoVbX6z7";
const MONGO_URL = process.env.MONGODB_URI || `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting SIMPLE export as fallback...');
    
    // Connect to MongoDB with timeout
    const client = new MongoClient(MONGO_URL, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 1
    });
    
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const experimentDb = client.db("experiment");
    
    // Super simple query - just get ANY 3 documents
    console.log('🔍 Running ultra-simple query...');
    const docs = await experimentDb.collection("finalExams")
      .find({})
      .limit(3)
      .maxTimeMS(5000)
      .toArray();
    
    console.log(`✅ Found ${docs.length} documents`);
    
    await client.close();
    
    // Create minimal Excel
    const workbook = XLSX.utils.book_new();
    const data = docs.map((doc, index) => ({
      'מספר': index + 1,
      'Student': doc.studentName || 'לא זמין',
      'Email': doc.studentEmail || 'לא זמין',
      'Status': doc.status || 'לא ידוע',
      'הודעה': 'זהו ייצוא פשוט לבדיקה - אם זה עובד, הבעיה הייתה בשאילתה המורכבת'
    }));
    
    const sheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, sheet, 'בדיקה פשוטה');
    
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="simple-test.xlsx"',
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('❌ Simple export failed:', error);
    
    // Even more basic fallback - just create an Excel with error message
    const workbook = XLSX.utils.book_new();
    const errorData = [{
      'שגיאה': error.message,
      'זמן': new Date().toISOString(),
      'הודעה': 'גם הייצוא הפשוט נכשל - יש בעיה בחיבור למסד הנתונים'
    }];
    
    const sheet = XLSX.utils.json_to_sheet(errorData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'שגיאה');
    
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="error-report.xlsx"',
        'Cache-Control': 'no-cache',
      },
    });
  }
}