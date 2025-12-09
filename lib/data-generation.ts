import { Db } from 'mongodb';
import { connectToDatabase, executeWithRetry, COLLECTIONS } from './database';
import { generateId } from './models';
import type { Dataset, DatasetTablePreview } from '@/app/homework/types';

/**
 * Data generation engine for expanding datasets with realistic data
 */

export interface DataGenerationConfig {
  targetRows: number;
  preserveExisting: boolean;
  dataTypes: {
    names?: boolean;
    emails?: boolean;
    dates?: boolean;
    numbers?: boolean;
    text?: boolean;
  };
  patterns: {
    realistic?: boolean;
    relationships?: boolean;
    constraints?: boolean;
  };
}

export interface GenerationStatus {
  id: string;
  datasetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  generatedRows?: number;
}

export interface DataGenerator {
  generateTableData(tableName: string, columns: string[], targetRows: number): any[];
  generateNames(count: number): string[];
  generateEmails(count: number, names?: string[]): string[];
  generateDates(count: number, startDate?: Date, endDate?: Date): string[];
  generateNumbers(count: number, min?: number, max?: number, type?: 'integer' | 'decimal'): number[];
  generateText(count: number, length?: number): string[];
}

/**
 * Realistic data generator with common patterns
 */
export class RealisticDataGenerator implements DataGenerator {
  private nameLists = {
    firstNames: [
      'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
      'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
      'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
      'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
      'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle'
    ],
    lastNames: [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
      'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
      'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
      'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
    ],
    departments: [
      'Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'IT', 'Customer Service',
      'Product', 'Design', 'Legal', 'Quality Assurance', 'Business Development', 'Research'
    ],
    cities: [
      'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio',
      'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus',
      'Charlotte', 'San Francisco', 'Indianapolis', 'Seattle', 'Denver', 'Washington'
    ]
  };

  generateNames(count: number): string[] {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const firstName = this.nameLists.firstNames[Math.floor(Math.random() * this.nameLists.firstNames.length)];
      const lastName = this.nameLists.lastNames[Math.floor(Math.random() * this.nameLists.lastNames.length)];
      names.push(`${firstName} ${lastName}`);
    }
    return names;
  }

  generateEmails(count: number, names?: string[]): string[] {
    const emails: string[] = [];
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'university.edu'];
    
    for (let i = 0; i < count; i++) {
      let emailName: string;
      if (names && names[i]) {
        const nameParts = names[i].toLowerCase().split(' ');
        emailName = `${nameParts[0]}.${nameParts[1]}${Math.floor(Math.random() * 100)}`;
      } else {
        emailName = `user${i + 1}${Math.floor(Math.random() * 1000)}`;
      }
      
      const domain = domains[Math.floor(Math.random() * domains.length)];
      emails.push(`${emailName}@${domain}`);
    }
    return emails;
  }

  generateDates(count: number, startDate: Date = new Date('2020-01-01'), endDate: Date = new Date()): string[] {
    const dates: string[] = [];
    const timeDiff = endDate.getTime() - startDate.getTime();
    
    for (let i = 0; i < count; i++) {
      const randomTime = startDate.getTime() + Math.random() * timeDiff;
      const date = new Date(randomTime);
      dates.push(date.toISOString().split('T')[0]); // YYYY-MM-DD format
    }
    return dates;
  }

  generateNumbers(count: number, min: number = 1, max: number = 1000, type: 'integer' | 'decimal' = 'integer'): number[] {
    const numbers: number[] = [];
    for (let i = 0; i < count; i++) {
      const random = Math.random() * (max - min) + min;
      if (type === 'integer') {
        numbers.push(Math.floor(random));
      } else {
        numbers.push(Math.round(random * 100) / 100); // 2 decimal places
      }
    }
    return numbers;
  }

  generateText(count: number, length: number = 50): string[] {
    const words = [
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
      'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
      'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation'
    ];
    
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const wordCount = Math.floor(length / 6); // Average word length
      const textWords: string[] = [];
      for (let j = 0; j < wordCount; j++) {
        textWords.push(words[Math.floor(Math.random() * words.length)]);
      }
      texts.push(textWords.join(' '));
    }
    return texts;
  }

  generateTableData(tableName: string, columns: string[], targetRows: number): any[] {
    const data: any[] = [];
    
    // Generate data based on column names and common patterns
    for (let i = 0; i < targetRows; i++) {
      const row: any = {};
      
      columns.forEach((column, index) => {
        const columnLower = column.toLowerCase();
        
        if (columnLower.includes('id') && index === 0) {
          row[column] = i + 1;
        } else if (columnLower.includes('name')) {
          if (!row.name) {
            const names = this.generateNames(1);
            row.name = names[0];
          }
          row[column] = row.name;
        } else if (columnLower.includes('email')) {
          row[column] = this.generateEmails(1, row.name ? [row.name] : undefined)[0];
        } else if (columnLower.includes('date') || columnLower.includes('time')) {
          row[column] = this.generateDates(1)[0];
        } else if (columnLower.includes('salary') || columnLower.includes('price') || columnLower.includes('amount')) {
          row[column] = this.generateNumbers(1, 30000, 150000, 'integer')[0];
        } else if (columnLower.includes('age')) {
          row[column] = this.generateNumbers(1, 18, 65, 'integer')[0];
        } else if (columnLower.includes('department')) {
          row[column] = this.nameLists.departments[Math.floor(Math.random() * this.nameLists.departments.length)];
        } else if (columnLower.includes('city') || columnLower.includes('location')) {
          row[column] = this.nameLists.cities[Math.floor(Math.random() * this.nameLists.cities.length)];
        } else if (columnLower.includes('description') || columnLower.includes('note')) {
          row[column] = this.generateText(1, 100)[0];
        } else if (columnLower.includes('active') || columnLower.includes('enabled')) {
          row[column] = Math.random() > 0.3; // 70% true
        } else if (columnLower.includes('count') || columnLower.includes('quantity')) {
          row[column] = this.generateNumbers(1, 0, 1000, 'integer')[0];
        } else {
          // Default to text for unknown columns
          row[column] = this.generateText(1, 20)[0];
        }
      });
      
      data.push(row);
    }
    
    return data;
  }
}

/**
 * Data generation service for managing dataset expansion
 */
export class DataGenerationService {
  private db: Db;
  private generator: DataGenerator;
  private generationStatus: Map<string, GenerationStatus> = new Map();

  constructor(db: Db) {
    this.db = db;
    this.generator = new RealisticDataGenerator();
  }

  /**
   * Start data generation for a dataset
   */
  async startGeneration(datasetId: string, config: DataGenerationConfig): Promise<string> {
    const generationId = generateId();
    
    const status: GenerationStatus = {
      id: generationId,
      datasetId,
      status: 'pending',
      progress: 0,
      message: 'Initializing data generation...',
      startedAt: new Date().toISOString(),
    };
    
    this.generationStatus.set(generationId, status);
    
    // Start generation in background
    this.performGeneration(generationId, datasetId, config).catch(error => {
      console.error('Generation failed:', error);
      const currentStatus = this.generationStatus.get(generationId);
      if (currentStatus) {
        currentStatus.status = 'failed';
        currentStatus.error = error.message;
        currentStatus.completedAt = new Date().toISOString();
      }
    });
    
    return generationId;
  }

  /**
   * Get generation status
   */
  getGenerationStatus(generationId: string): GenerationStatus | null {
    return this.generationStatus.get(generationId) || null;
  }

  /**
   * Perform the actual data generation
   */
  private async performGeneration(generationId: string, datasetId: string, config: DataGenerationConfig): Promise<void> {
    const status = this.generationStatus.get(generationId);
    if (!status) return;

    try {
      status.status = 'running';
      status.message = 'Loading dataset...';
      
      // Get dataset
      const { ObjectId } = await import('mongodb');
      let dataset;
      
      console.log('Looking for dataset with ID:', datasetId);
      console.log('Is valid ObjectId:', ObjectId.isValid(datasetId));
      
      // Try to find by ObjectId first, then by string id
      if (ObjectId.isValid(datasetId)) {
        console.log('Searching by ObjectId...');
        dataset = await this.db
          .collection(COLLECTIONS.DATASETS)
          .findOne({ _id: new ObjectId(datasetId) });
        console.log('Found by ObjectId:', !!dataset);
      }
      
      // If not found by ObjectId, try by string id
      if (!dataset) {
        console.log('Searching by string id...');
        dataset = await this.db
          .collection(COLLECTIONS.DATASETS)
          .findOne({ id: datasetId });
        console.log('Found by string id:', !!dataset);
      }
      
      // If still not found, try a broader search to see what's available
      if (!dataset) {
        console.log('Dataset not found, checking available datasets...');
        const allDatasets = await this.db
          .collection(COLLECTIONS.DATASETS)
          .find({})
          .limit(5)
          .toArray();
        console.log('Available datasets:', allDatasets.map(d => ({ id: d._id, stringId: d.id, name: d.name })));
      }
      
      if (!dataset) {
        console.error('Dataset not found:', {
          datasetId,
          isValidObjectId: ObjectId.isValid(datasetId),
          collections: (await this.db.listCollections().toArray()).map(col => col.name)
        });
        throw new Error(`Dataset not found with ID: ${datasetId}`);
      }

      status.progress = 10;
      status.message = 'Generating data for tables...';

      // Generate data for each table
      const generatedData: { [tableName: string]: any[] } = {};
      const tableCount = dataset.previewTables.length;
      
      for (let i = 0; i < tableCount; i++) {
        const table = dataset.previewTables[i];
        status.message = `Generating data for table: ${table.name}`;
        status.progress = 10 + (i / tableCount) * 80;
        
        generatedData[table.name] = this.generator.generateTableData(
          table.name,
          table.columns,
          config.targetRows
        );
      }

      status.progress = 90;
      status.message = 'Saving generated data...';

      // Store generated data (in a real implementation, this would save to the actual database)
      // For now, we'll store it in a generation results collection
      await this.db.collection('generated_data').insertOne({
        generationId,
        datasetId,
        config,
        data: generatedData,
        createdAt: new Date().toISOString(),
      });

      status.status = 'completed';
      status.progress = 100;
      status.message = 'Data generation completed successfully';
      status.completedAt = new Date().toISOString();
      status.generatedRows = config.targetRows * tableCount;

    } catch (error: any) {
      status.status = 'failed';
      status.error = error.message;
      status.completedAt = new Date().toISOString();
      throw error;
    }
  }

  /**
   * Rollback generated data
   */
  async rollbackGeneration(datasetId: string): Promise<boolean> {
    try {
      // Remove generated data
      const result = await this.db.collection('generated_data').deleteMany({ datasetId });
      
      // Clear any pending generations
      for (const [id, status] of Array.from(this.generationStatus.entries())) {
        if (status.datasetId === datasetId && status.status === 'pending') {
          status.status = 'failed';
          status.error = 'Rolled back by user';
          status.completedAt = new Date().toISOString();
        }
      }
      
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Rollback failed:', error);
      return false;
    }
  }

  /**
   * Validate generated data integrity
   */
  async validateGeneratedData(datasetId: string): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      const generatedData = await this.db
        .collection('generated_data')
        .findOne({ datasetId });
      
      if (!generatedData) {
        issues.push('No generated data found');
        return { valid: false, issues };
      }

      // Basic validation checks
      const data = generatedData.data;
      const tableNames = Object.keys(data);
      
      if (tableNames.length === 0) {
        issues.push('No tables generated');
      }
      
      for (const tableName of tableNames) {
        const tableData = data[tableName];
        if (!Array.isArray(tableData)) {
          issues.push(`Table ${tableName} data is not an array`);
          continue;
        }
        
        if (tableData.length === 0) {
          issues.push(`Table ${tableName} is empty`);
          continue;
        }
        
        // Check for consistent column structure
        const firstRow = tableData[0];
        const firstRowKeys = Object.keys(firstRow);
        
        for (const row of tableData.slice(1)) {
          const rowKeys = Object.keys(row);
          if (rowKeys.length !== firstRowKeys.length) {
            issues.push(`Table ${tableName} has inconsistent column count`);
            break;
          }
        }
      }
      
      return { valid: issues.length === 0, issues };
      
    } catch (error: any) {
      issues.push(`Validation error: ${error.message}`);
      return { valid: false, issues };
    }
  }
}

/**
 * Static service instance
 */
let dataGenerationService: DataGenerationService | null = null;

export async function getDataGenerationService(): Promise<DataGenerationService> {
  if (!dataGenerationService) {
    const { db } = await connectToDatabase();
    dataGenerationService = new DataGenerationService(db);
  }
  return dataGenerationService;
}

/**
 * Convenience functions
 */
export async function startDataGeneration(datasetId: string, config: DataGenerationConfig): Promise<string> {
  const service = await getDataGenerationService();
  return service.startGeneration(datasetId, config);
}

export async function getGenerationStatus(generationId: string): Promise<GenerationStatus | null> {
  const service = await getDataGenerationService();
  return service.getGenerationStatus(generationId);
}

export async function rollbackDataGeneration(datasetId: string): Promise<boolean> {
  const service = await getDataGenerationService();
  return service.rollbackGeneration(datasetId);
}

export async function validateGeneratedData(datasetId: string): Promise<{ valid: boolean; issues: string[] }> {
  const service = await getDataGenerationService();
  return service.validateGeneratedData(datasetId);
}
