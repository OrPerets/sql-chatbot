#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

/**
 * Export Homework 1 data to local JSON files
 * Simple version using the existing export pattern
 */

const COLLECTIONS = {
  HOMEWORK_SETS: 'homework_sets',
  QUESTIONS: 'questions',
  SUBMISSIONS: 'submissions',
  DATASETS: 'datasets',
  ANALYTICS: 'analytics_events',
  QUESTION_TEMPLATES: 'question_templates',
  INSTANTIATED_QUESTIONS: 'instantiated_questions',
  ANALYSIS_RESULTS: 'analysis_results',
};

class HomeworkExporter {
  constructor(db, outputDir = './exports') {
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
  serializeDocument(doc) {
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
   * Find homework set by title or ID
   */
  async findHomeworkSet(identifier) {
    console.log(`🔍 Looking for homework set: ${identifier}`);
    
    // Get all homework sets
    const allHomework = await this.db.collection(COLLECTIONS.HOMEWORK_SETS).find({}).toArray();
    
    // Try to find by ID first
    let homeworkSet = allHomework.find(hw => hw._id.toString() === identifier || hw.id === identifier);
    
    if (!homeworkSet) {
      // Try to find by title (case insensitive)
      homeworkSet = allHomework.find(hw => 
        hw.title.toLowerCase().includes(identifier.toLowerCase())
      );
    }
    
    if (homeworkSet) {
      console.log(`✅ Found homework set: ${homeworkSet.title} (ID: ${homeworkSet._id})`);
    } else {
      console.log(`❌ Homework set not found: ${identifier}`);
      console.log('\nAvailable homework sets:');
      allHomework.forEach((hw, index) => {
        console.log(`  ${index + 1}. ${hw.title} (ID: ${hw._id})`);
        console.log(`     Course: ${hw.courseId}`);
        console.log(`     Due: ${hw.dueAt}`);
        console.log(`     Published: ${hw.published ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
    
    return homeworkSet;
  }

  /**
   * Export all data related to a homework set
   */
  async exportHomeworkData(homeworkSetId) {
    console.log(`🚀 Starting export for homework set: ${homeworkSetId}`);
    
    // Get homework set details
    console.log('📋 Getting homework set details...');
    const homeworkSet = await this.db.collection(COLLECTIONS.HOMEWORK_SETS).findOne({ _id: homeworkSetId });
    
    if (!homeworkSet) {
      throw new Error(`Homework set not found: ${homeworkSetId}`);
    }
    
    // Get questions
    console.log('❓ Getting questions...');
    const questions = await this.db.collection(COLLECTIONS.QUESTIONS).find({ homeworkSetId: homeworkSetId.toString() }).toArray();
    console.log(`Found ${questions.length} questions`);
    
    // Get submissions
    console.log('📝 Getting submissions...');
    const submissions = await this.db.collection(COLLECTIONS.SUBMISSIONS).find({ homeworkSetId: homeworkSetId.toString() }).toArray();
    console.log(`Found ${submissions.length} submissions`);
    
    // Get datasets used by questions
    console.log('📊 Getting datasets...');
    const datasetIds = [...new Set(questions.map(q => q.datasetId).filter(Boolean))];
    const datasets = [];
    for (const datasetId of datasetIds) {
      const dataset = await this.db.collection(COLLECTIONS.DATASETS).findOne({ _id: datasetId });
      if (dataset) {
        datasets.push(dataset);
      }
    }
    console.log(`Found ${datasets.length} datasets`);
    
    // Get analytics events
    console.log('📈 Getting analytics...');
    const analytics = await this.db.collection(COLLECTIONS.ANALYTICS).find({ setId: homeworkSetId.toString() }).toArray();
    console.log(`Found ${analytics.length} analytics events`);
    
    // Get question templates
    console.log('📋 Getting question templates...');
    const templates = await this.db.collection(COLLECTIONS.QUESTION_TEMPLATES).find({}).toArray();
    console.log(`Found ${templates.length} question templates`);
    
    // Get instantiated questions
    console.log('🔄 Getting instantiated questions...');
    const instantiatedQuestions = await this.db.collection(COLLECTIONS.INSTANTIATED_QUESTIONS).find({ homeworkSetId: homeworkSetId.toString() }).toArray();
    console.log(`Found ${instantiatedQuestions.length} instantiated questions`);
    
    // Get analysis results
    console.log('🤖 Getting analysis results...');
    const analysisResults = await this.db.collection(COLLECTIONS.ANALYSIS_RESULTS).find({ homeworkSetId: homeworkSetId.toString() }).toArray();
    console.log(`Found ${analysisResults.length} analysis results`);
    
    // Create export data
    const exportData = {
      homeworkSet: this.serializeDocument(homeworkSet),
      questions: questions.map(q => this.serializeDocument(q)),
      submissions: submissions.map(s => this.serializeDocument(s)),
      datasets: datasets.map(d => this.serializeDocument(d)),
      analytics: analytics.map(a => this.serializeDocument(a)),
      templates: templates.map(t => this.serializeDocument(t)),
      instantiatedQuestions: instantiatedQuestions.map(iq => this.serializeDocument(iq)),
      analysisResults: analysisResults.map(ar => this.serializeDocument(ar)),
      metadata: {
        exportDate: new Date().toISOString(),
        homeworkSetId: homeworkSetId.toString(),
        totalQuestions: questions.length,
        totalSubmissions: submissions.length,
        totalDatasets: datasets.length,
      }
    };
    
    return exportData;
  }

  /**
   * Save export data to JSON file
   */
  async saveToFile(data, filename) {
    const filepath = path.join(this.outputDir, filename);
    const jsonString = JSON.stringify(data, null, 2);
    
    fs.writeFileSync(filepath, jsonString, 'utf8');
    console.log(`💾 Saved export to: ${filepath}`);
  }
}

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  
  // Database connection configuration
  const MONGODB_URI = process.env.MONGODB_URI || `mongodb+srv://${process.env.DB_USERNAME || 'sql-admin'}:${process.env.DB_PASSWORD || 'SMff5PqhhoVbX6z7'}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  const DB_NAME = process.env.DB_NAME || 'experiment';
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to database successfully!');
    
    const db = client.db(DB_NAME);
    
    // Create exporter
    const exporter = new HomeworkExporter(db, './exports');
    
    // Try to find homework 1
    const homeworkIdentifier = '1'; // Try ID first, then title
    const homeworkSet = await exporter.findHomeworkSet(homeworkIdentifier);
    
    if (!homeworkSet) {
      console.log('\n❌ Homework 1 not found. Please check the list above and try with a different identifier.');
      console.log('Usage: node export-homework-1-simple.js [homework-id-or-title]');
      return;
    }
    
    // Export the homework data
    console.log(`\n🚀 Exporting data for: ${homeworkSet.title}`);
    const exportData = await exporter.exportHomeworkData(homeworkSet._id);
    
    // Save to file
    const filename = `homework-${homeworkSet._id}-export.json`;
    await exporter.saveToFile(exportData, filename);
    
    // Also create individual files for easier access
    console.log('\n📁 Creating individual files...');
    
    // Homework set details
    await exporter.saveToFile(
      { homeworkSet: exportData.homeworkSet, metadata: exportData.metadata },
      `homework-${homeworkSet._id}-details.json`
    );
    
    // Questions
    await exporter.saveToFile(
      { questions: exportData.questions, metadata: exportData.metadata },
      `homework-${homeworkSet._id}-questions.json`
    );
    
    // Submissions
    await exporter.saveToFile(
      { submissions: exportData.submissions, metadata: exportData.metadata },
      `homework-${homeworkSet._id}-submissions.json`
    );
    
    // Datasets
    await exporter.saveToFile(
      { datasets: exportData.datasets, metadata: exportData.metadata },
      `homework-${homeworkSet._id}-datasets.json`
    );
    
    console.log('\n✨ Export completed successfully!');
    console.log('📁 Check the ./exports directory for your JSON files:');
    console.log(`  - ${filename} (complete export)`);
    console.log(`  - homework-${homeworkSet._id}-details.json`);
    console.log(`  - homework-${homeworkSet._id}-questions.json`);
    console.log(`  - homework-${homeworkSet._id}-submissions.json`);
    console.log(`  - homework-${homeworkSet._id}-datasets.json`);
    
    console.log('\n📊 Export Summary:');
    console.log(`  Homework Set: ${exportData.homeworkSet.title}`);
    console.log(`  Questions: ${exportData.metadata.totalQuestions}`);
    console.log(`  Submissions: ${exportData.metadata.totalSubmissions}`);
    console.log(`  Datasets: ${exportData.metadata.totalDatasets}`);
    console.log(`  Analytics Events: ${exportData.analytics.length}`);
    console.log(`  Question Templates: ${exportData.templates.length}`);
    console.log(`  Instantiated Questions: ${exportData.instantiatedQuestions.length}`);
    console.log(`  Analysis Results: ${exportData.analysisResults.length}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
main().catch(console.error);
