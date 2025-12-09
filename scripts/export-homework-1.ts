#!/usr/bin/env ts-node

import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { connectToDatabase, COLLECTIONS } from '../lib/database.js';
import { HomeworkService } from '../lib/homework.js';
import { QuestionsService } from '../lib/questions.js';
import { SubmissionsService } from '../lib/submissions.js';
import { DatasetService } from '../lib/datasets.js';
import type { HomeworkSet, Question, PaginatedResponse, HomeworkSummary } from '../app/homework/types.js';

/**
 * Export Homework 1 data to local JSON files
 * Exports: homework set, questions, submissions, datasets, and related data
 */

interface ExportOptions {
  outputDir?: string;
  prettyPrint?: boolean;
  includeMetadata?: boolean;
}

interface HomeworkExportData {
  homeworkSet: HomeworkSet | null;
  questions: Question[];
  submissions: any[];
  datasets: any[];
  analytics: any[];
  templates: any[];
  instantiatedQuestions: any[];
  analysisResults: any[];
  metadata: {
    exportDate: string;
    homeworkSetId: string;
    totalQuestions: number;
    totalSubmissions: number;
    totalDatasets: number;
  };
}

class HomeworkExporter {
  private db: any;
  private outputDir: string;
  private homeworkService: HomeworkService;
  private questionsService: QuestionsService;
  private submissionsService: SubmissionsService;
  private datasetsService: DatasetService;

  constructor(db: any, outputDir: string = './exports') {
    this.db = db;
    this.outputDir = outputDir;
    this.homeworkService = new HomeworkService(db);
    this.questionsService = new QuestionsService(db);
    this.submissionsService = new SubmissionsService(db);
    this.datasetsService = new DatasetService(db);
    
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
   * Find homework set by title or ID
   */
  async findHomeworkSet(identifier: string): Promise<HomeworkSet | null> {
    console.log(`🔍 Looking for homework set: ${identifier}`);
    
    // First try to find by ID
    let homeworkSet = await this.homeworkService.getHomeworkSetById(identifier);
    
    if (!homeworkSet) {
      // Try to find by title (case insensitive)
      const allHomework = await this.homeworkService.listHomeworkSets({ pageSize: 1000 });
      homeworkSet = allHomework.items.find(hw => 
        hw.title.toLowerCase().includes(identifier.toLowerCase()) ||
        hw.id === identifier
      ) || null;
    }
    
    if (homeworkSet) {
      console.log(`✅ Found homework set: ${homeworkSet.title} (ID: ${homeworkSet.id})`);
    } else {
      console.log(`❌ Homework set not found: ${identifier}`);
    }
    
    return homeworkSet;
  }

  /**
   * Export all data related to a homework set
   */
  async exportHomeworkData(homeworkSetId: string, options: ExportOptions = {}): Promise<HomeworkExportData> {
    const { prettyPrint = true, includeMetadata = true } = options;
    
    console.log(`🚀 Starting export for homework set: ${homeworkSetId}`);
    
    // Get homework set details
    console.log('📋 Getting homework set details...');
    const homeworkSet = await this.homeworkService.getHomeworkSetById(homeworkSetId);
    
    if (!homeworkSet) {
      throw new Error(`Homework set not found: ${homeworkSetId}`);
    }
    
    // Get questions
    console.log('❓ Getting questions...');
    const questions = await this.questionsService.getQuestionsByHomeworkSet(homeworkSetId);
    console.log(`Found ${questions.length} questions`);
    
    // Get submissions
    console.log('📝 Getting submissions...');
    const submissions = await this.db
      .collection(COLLECTIONS.SUBMISSIONS)
      .find({ homeworkSetId })
      .toArray();
    console.log(`Found ${submissions.length} submissions`);
    
    // Get datasets used by questions
    console.log('📊 Getting datasets...');
    const datasetIds = Array.from(new Set(questions.map(q => q.datasetId).filter(Boolean)));
    const datasets = [];
    for (const datasetId of datasetIds) {
      const dataset = await this.datasetsService.getDatasetById(datasetId);
      if (dataset) {
        datasets.push(dataset);
      }
    }
    console.log(`Found ${datasets.length} datasets`);
    
    // Get analytics events
    console.log('📈 Getting analytics...');
    const analytics = await this.db
      .collection(COLLECTIONS.ANALYTICS)
      .find({ setId: homeworkSetId })
      .toArray();
    console.log(`Found ${analytics.length} analytics events`);
    
    // Get question templates (if any)
    console.log('📋 Getting question templates...');
    const templates = await this.db
      .collection(COLLECTIONS.QUESTION_TEMPLATES)
      .find({})
      .toArray();
    console.log(`Found ${templates.length} question templates`);
    
    // Get instantiated questions
    console.log('🔄 Getting instantiated questions...');
    const instantiatedQuestions = await this.db
      .collection(COLLECTIONS.INSTANTIATED_QUESTIONS)
      .find({ homeworkSetId })
      .toArray();
    console.log(`Found ${instantiatedQuestions.length} instantiated questions`);
    
    // Get analysis results
    console.log('🤖 Getting analysis results...');
    const analysisResults = await this.db
      .collection(COLLECTIONS.ANALYSIS_RESULTS)
      .find({ homeworkSetId })
      .toArray();
    console.log(`Found ${analysisResults.length} analysis results`);
    
    // Create export data
    const exportData: HomeworkExportData = {
      homeworkSet: homeworkSet,
      questions: questions,
      submissions: submissions.map(sub => this.serializeDocument(sub)),
      datasets: datasets.map(ds => this.serializeDocument(ds)),
      analytics: analytics.map(anal => this.serializeDocument(anal)),
      templates: templates.map(tmpl => this.serializeDocument(tmpl)),
      instantiatedQuestions: instantiatedQuestions.map(iq => this.serializeDocument(iq)),
      analysisResults: analysisResults.map(ar => this.serializeDocument(ar)),
      metadata: {
        exportDate: new Date().toISOString(),
        homeworkSetId: homeworkSetId,
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
  async saveToFile(data: any, filename: string, options: ExportOptions = {}): Promise<void> {
    const { prettyPrint = true } = options;
    
    const filepath = path.join(this.outputDir, filename);
    const jsonString = prettyPrint 
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    
    fs.writeFileSync(filepath, jsonString, 'utf8');
    console.log(`💾 Saved export to: ${filepath}`);
  }

  /**
   * List all available homework sets
   */
  async listAllHomeworkSets(): Promise<void> {
    console.log('📋 Listing all available homework sets...');
    
    const allHomework = await this.homeworkService.listHomeworkSets({ pageSize: 1000 });
    
    console.log(`\nFound ${allHomework.items.length} homework sets:`);
    allHomework.items.forEach((hw, index) => {
      console.log(`  ${index + 1}. ${hw.title} (ID: ${hw.id})`);
      console.log(`     Course: ${hw.courseId}`);
      console.log(`     Due: ${hw.dueAt}`);
      console.log(`     Published: ${hw.published ? 'Yes' : 'No'}`);
      console.log(`     Questions: ${hw.draftQuestionCount || 'Unknown'}`);
      console.log('');
    });
  }
}

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  
  try {
    const { db } = await connectToDatabase();
    console.log('✅ Connected to database successfully!');
    
    // Create exporter
    const exporter = new HomeworkExporter(db, './exports');
    
    // List all homework sets first
    await exporter.listAllHomeworkSets();
    
    // Try to find homework 1
    const homeworkIdentifier = '1'; // Try ID first, then title
    const homeworkSet = await exporter.findHomeworkSet(homeworkIdentifier);
    
    if (!homeworkSet) {
      console.log('\n❌ Homework 1 not found. Please check the list above and try with a different identifier.');
      console.log('Usage: node export-homework-1.ts [homework-id-or-title]');
      return;
    }
    
    // Export the homework data
    console.log(`\n🚀 Exporting data for: ${homeworkSet.title}`);
    const exportData = await exporter.exportHomeworkData(homeworkSet.id, {
      prettyPrint: true,
      includeMetadata: true
    });
    
    // Save to file
    const filename = `homework-${homeworkSet.id}-export.json`;
    await exporter.saveToFile(exportData, filename);
    
    // Also create individual files for easier access
    console.log('\n📁 Creating individual files...');
    
    // Homework set details
    await exporter.saveToFile(
      { homeworkSet: exportData.homeworkSet, metadata: exportData.metadata },
      `homework-${homeworkSet.id}-details.json`
    );
    
    // Questions
    await exporter.saveToFile(
      { questions: exportData.questions, metadata: exportData.metadata },
      `homework-${homeworkSet.id}-questions.json`
    );
    
    // Submissions
    await exporter.saveToFile(
      { submissions: exportData.submissions, metadata: exportData.metadata },
      `homework-${homeworkSet.id}-submissions.json`
    );
    
    // Datasets
    await exporter.saveToFile(
      { datasets: exportData.datasets, metadata: exportData.metadata },
      `homework-${homeworkSet.id}-datasets.json`
    );
    
    console.log('\n✨ Export completed successfully!');
    console.log('📁 Check the ./exports directory for your JSON files:');
    console.log(`  - ${filename} (complete export)`);
    console.log(`  - homework-${homeworkSet.id}-details.json`);
    console.log(`  - homework-${homeworkSet.id}-questions.json`);
    console.log(`  - homework-${homeworkSet.id}-submissions.json`);
    console.log(`  - homework-${homeworkSet.id}-datasets.json`);
    
    console.log('\n📊 Export Summary:');
    console.log(`  Homework Set: ${exportData.homeworkSet?.title}`);
    console.log(`  Questions: ${exportData.metadata.totalQuestions}`);
    console.log(`  Submissions: ${exportData.metadata.totalSubmissions}`);
    console.log(`  Datasets: ${exportData.metadata.totalDatasets}`);
    console.log(`  Analytics Events: ${exportData.analytics.length}`);
    console.log(`  Question Templates: ${exportData.templates.length}`);
    console.log(`  Instantiated Questions: ${exportData.instantiatedQuestions.length}`);
    console.log(`  Analysis Results: ${exportData.analysisResults.length}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    return;
  }
}

// Run the script
main().catch(console.error);

export { HomeworkExporter };
