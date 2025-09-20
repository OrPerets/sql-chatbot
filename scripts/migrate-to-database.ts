#!/usr/bin/env tsx

/**
 * Migration script to move hardcoded homework data from mock store to MongoDB
 * Run with: npx tsx scripts/migrate-to-database.ts
 */

import { connectToDatabase, COLLECTIONS } from '../lib/database';
import { generateId } from '../lib/models';

// Import the hardcoded data from the mock store
const datasets = [
  {
    id: "dataset-retail",
    name: "Retail Orders 2024",
    description: "Sample transactional dataset for SQL practice",
    connectionUri: "sandbox://datasets/retail-orders",
    previewTables: [
      { name: "orders", columns: ["order_id", "customer_id", "order_date", "total_amount"] },
      { name: "customers", columns: ["customer_id", "name", "loyalty_tier"] },
    ],
    tags: ["retail", "orders"],
    updatedAt: new Date().toISOString(),
  },
  {
    id: "dataset-bikeshare",
    name: "City Bikeshare Trips",
    description: "Rideshare dataset with trips, stations, and weather joins",
    connectionUri: "sandbox://datasets/bikeshare",
    previewTables: [
      { name: "trips", columns: ["trip_id", "start_time", "duration", "start_station_id"] },
      { name: "stations", columns: ["station_id", "name", "lat", "lng"] },
    ],
    tags: ["transport", "time-series"],
    updatedAt: new Date().toISOString(),
  },
];

const homeworkRecords = [
  {
    set: {
      id: "hw-set-analytics",
      title: "Analytics Fundamentals — Window Functions",
      courseId: "CS305",
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      published: false,
      datasetPolicy: "shared",
      questionOrder: ["q1", "q2", "q3"],
      visibility: "draft",
      createdBy: "instructor-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      overview: "Work through the analytics scenarios below. Each question allows three attempts and expects ANSI SQL compatible with our sandboxed executor.",
    },
    questions: [
      {
        id: "q1",
        prompt: "Identify top three customers by total spend",
        instructions: "Join orders and customers tables, aggregate total_amount, order desc.",
        starterSql: "SELECT c.name, SUM(o.total_amount) AS total_spend FROM orders o JOIN customers c ON o.customer_id = c.customer_id GROUP BY 1 ORDER BY 2 DESC LIMIT 3;",
        expectedResultSchema: [
          { column: "name", type: "string" },
          { column: "total_spend", type: "number" },
        ],
        gradingRubric: [
          {
            id: generateId(),
            label: "Correct aggregation",
            description: "SUM by customer",
            weight: 60,
            autoGraded: true,
          },
          {
            id: generateId(),
            label: "Ordering",
            description: "Results sorted descending",
            weight: 40,
            autoGraded: true,
          },
        ],
        datasetId: "dataset-retail",
        maxAttempts: 3,
        points: 10,
        evaluationMode: "auto",
      },
      {
        id: "q2",
        prompt: "Calculate 7-day moving average of total sales",
        instructions: "Use window functions over orders table grouped by date.",
        starterSql: "",
        expectedResultSchema: [
          { column: "order_date", type: "date" },
          { column: "moving_avg", type: "number" },
        ],
        gradingRubric: [
          {
            id: generateId(),
            label: "Window function",
            description: "Uses WINDOW clause",
            weight: 70,
            autoGraded: true,
          },
          {
            id: generateId(),
            label: "Date coverage",
            description: "All dates included",
            weight: 30,
            autoGraded: false,
          },
        ],
        datasetId: "dataset-retail",
        maxAttempts: 3,
        points: 10,
        evaluationMode: "auto",
      },
      {
        id: "q3",
        prompt: "Flag customers with month-over-month growth over 20%",
        instructions: "Combine aggregation with window lag comparison.",
        starterSql: "",
        expectedResultSchema: [
          { column: "customer_id", type: "string" },
          { column: "growth_rate", type: "number" },
        ],
        gradingRubric: [
          {
            id: generateId(),
            label: "Growth calculation",
            description: "Correctly compares current and previous month",
            weight: 60,
            autoGraded: true,
          },
          {
            id: generateId(),
            label: "Threshold filter",
            description: "Applies >20% threshold",
            weight: 40,
            autoGraded: true,
          },
        ],
        datasetId: "dataset-retail",
        maxAttempts: 3,
        points: 10,
        evaluationMode: "auto",
      },
    ],
  },
];

const submissionRecords = [
  {
    id: "submission-rose",
    homeworkSetId: "hw-set-analytics",
    studentId: "student-rose",
    attemptNumber: 1,
    answers: {
      q1: {
        sql: "SELECT c.name, SUM(o.total_amount) AS total_spend FROM orders o JOIN customers c ON o.customer_id = c.customer_id GROUP BY 1 ORDER BY 2 DESC LIMIT 3;",
        resultPreview: {
          columns: ["name", "total_spend"],
          rows: [
            { name: "Avery Patel", total_spend: 18200.54 },
            { name: "Noam Chen", total_spend: 17650.2 },
            { name: "Lina Wu", total_spend: 16990.91 },
          ],
          executionMs: 118,
          truncated: false,
        },
        feedback: {
          questionId: "q1",
          score: 10,
          autoNotes: "Top spenders match expected result set.",
          rubricBreakdown: [],
        },
        lastExecutedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        executionCount: 2,
      },
      q2: {
        sql: "SELECT order_date, AVG(total_amount) OVER (ORDER BY order_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS moving_avg FROM orders;",
        resultPreview: {
          columns: ["order_date", "moving_avg"],
          rows: [
            { order_date: "2024-01-05", moving_avg: 1250.12 },
            { order_date: "2024-01-06", moving_avg: 1297.44 },
            { order_date: "2024-01-07", moving_avg: 1302.67 },
          ],
          executionMs: 162,
          truncated: false,
        },
        feedback: {
          questionId: "q2",
          score: 9,
          autoNotes: "Window frame correct; check rounding for final submission.",
          rubricBreakdown: [],
        },
        lastExecutedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
        executionCount: 3,
      },
      q3: {
        sql: "SELECT customer_id, growth_rate FROM customer_growth WHERE growth_rate > 0.2 ORDER BY growth_rate DESC;",
        resultPreview: {
          columns: ["customer_id", "growth_rate"],
          rows: [
            { customer_id: "C-204", growth_rate: 0.28 },
            { customer_id: "C-058", growth_rate: 0.24 },
          ],
          executionMs: 143,
          truncated: false,
        },
        feedback: {
          questionId: "q3",
          score: 8,
          autoNotes: "Consider adding previous month totals to support audit.",
          rubricBreakdown: [],
        },
        lastExecutedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 22 * 60 * 1000).toISOString(),
        executionCount: 2,
      },
    },
    overallScore: 27,
    status: "graded",
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    gradedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 32 * 60 * 1000).toISOString(),
  },
  {
    id: "submission-demo-student",
    homeworkSetId: "hw-set-analytics",
    studentId: "student-demo",
    attemptNumber: 1,
    answers: {
      q1: { sql: "", executionCount: 0 },
      q2: { sql: "", executionCount: 0 },
      q3: { sql: "", executionCount: 0 },
    },
    overallScore: 0,
    status: "in_progress",
    submittedAt: undefined,
    gradedAt: undefined,
  },
];

async function createIndexes(db: any) {
  console.log('📊 Creating database indexes...');
  // TODO: Define database indexes if needed
  console.log('⚠️  No indexes defined - skipping index creation');
}

async function migrateDatasets(db: any) {
  console.log('📁 Migrating datasets...');
  
  const collection = db.collection(COLLECTIONS.DATASETS);
  
  for (const dataset of datasets) {
    try {
      // Check if dataset already exists
      const existing = await collection.findOne({ id: dataset.id });
      if (existing) {
        console.log(`⚠️  Dataset ${dataset.id} already exists, skipping...`);
        continue;
      }
      
      await collection.insertOne({
        ...dataset,
        _id: dataset.id, // Use the existing ID as ObjectId
      });
      console.log(`✅ Migrated dataset: ${dataset.name}`);
    } catch (error) {
      console.error(`❌ Failed to migrate dataset ${dataset.id}:`, error);
    }
  }
}

async function migrateHomeworkSets(db: any) {
  console.log('📚 Migrating homework sets...');
  
  const collection = db.collection(COLLECTIONS.HOMEWORK_SETS);
  
  for (const record of homeworkRecords) {
    try {
      // Check if homework set already exists
      const existing = await collection.findOne({ id: record.set.id });
      if (existing) {
        console.log(`⚠️  Homework set ${record.set.id} already exists, skipping...`);
        continue;
      }
      
      await collection.insertOne({
        ...record.set,
        _id: record.set.id, // Use the existing ID as ObjectId
      });
      console.log(`✅ Migrated homework set: ${record.set.title}`);
    } catch (error) {
      console.error(`❌ Failed to migrate homework set ${record.set.id}:`, error);
    }
  }
}

async function migrateQuestions(db: any) {
  console.log('❓ Migrating questions...');
  
  const collection = db.collection(COLLECTIONS.QUESTIONS);
  
  for (const record of homeworkRecords) {
    for (const question of record.questions) {
      try {
        // Check if question already exists
        const existing = await collection.findOne({ id: question.id });
        if (existing) {
          console.log(`⚠️  Question ${question.id} already exists, skipping...`);
          continue;
        }
        
        await collection.insertOne({
          ...question,
          homeworkSetId: record.set.id,
          _id: question.id, // Use the existing ID as ObjectId
        });
        console.log(`✅ Migrated question: ${question.prompt.substring(0, 50)}...`);
      } catch (error) {
        console.error(`❌ Failed to migrate question ${question.id}:`, error);
      }
    }
  }
}

async function migrateSubmissions(db: any) {
  console.log('📝 Migrating submissions...');
  
  const collection = db.collection(COLLECTIONS.SUBMISSIONS);
  
  for (const submission of submissionRecords) {
    try {
      // Check if submission already exists
      const existing = await collection.findOne({ id: submission.id });
      if (existing) {
        console.log(`⚠️  Submission ${submission.id} already exists, skipping...`);
        continue;
      }
      
      await collection.insertOne({
        ...submission,
        _id: submission.id, // Use the existing ID as ObjectId
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`✅ Migrated submission: ${submission.id}`);
    } catch (error) {
      console.error(`❌ Failed to migrate submission ${submission.id}:`, error);
    }
  }
}

async function main() {
  try {
    console.log('🚀 Starting migration from hardcoded data to MongoDB...');
    
    const { db } = await connectToDatabase();
    
    // Create indexes first
    await createIndexes(db);
    
    // Migrate data in order (datasets -> homework sets -> questions -> submissions)
    await migrateDatasets(db);
    await migrateHomeworkSets(db);
    await migrateQuestions(db);
    await migrateSubmissions(db);
    
    console.log('🎉 Migration completed successfully!');
    
    // Print summary
    const counts = await Promise.all([
      db.collection(COLLECTIONS.DATASETS).countDocuments(),
      db.collection(COLLECTIONS.HOMEWORK_SETS).countDocuments(),
      db.collection(COLLECTIONS.QUESTIONS).countDocuments(),
      db.collection(COLLECTIONS.SUBMISSIONS).countDocuments(),
    ]);
    
    console.log('\n📊 Migration Summary:');
    console.log(`  Datasets: ${counts[0]}`);
    console.log(`  Homework Sets: ${counts[1]}`);
    console.log(`  Questions: ${counts[2]}`);
    console.log(`  Submissions: ${counts[3]}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main();
}

export { main as migrateToDatabase };
