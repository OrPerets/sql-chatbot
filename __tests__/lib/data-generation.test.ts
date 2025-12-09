import { RealisticDataGenerator, DataGenerationService } from '@/lib/data-generation';

describe('RealisticDataGenerator', () => {
  let generator: RealisticDataGenerator;

  beforeEach(() => {
    generator = new RealisticDataGenerator();
  });

  describe('generateNames', () => {
    it('should generate the correct number of names', () => {
      const names = generator.generateNames(5);
      expect(names).toHaveLength(5);
    });

    it('should generate realistic name formats', () => {
      const names = generator.generateNames(10);
      names.forEach(name => {
        expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
      });
    });

    it('should generate different names', () => {
      const names1 = generator.generateNames(100);
      const names2 = generator.generateNames(100);
      
      // Should have some overlap but not be identical
      const overlap = names1.filter(name => names2.includes(name));
      expect(overlap.length).toBeGreaterThan(0);
      expect(overlap.length).toBeLessThan(names1.length);
    });
  });

  describe('generateEmails', () => {
    it('should generate the correct number of emails', () => {
      const emails = generator.generateEmails(5);
      expect(emails).toHaveLength(5);
    });

    it('should generate valid email formats', () => {
      const emails = generator.generateEmails(10);
      emails.forEach(email => {
        expect(email).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
      });
    });

    it('should use provided names when available', () => {
      const names = ['John Doe', 'Jane Smith'];
      const emails = generator.generateEmails(2, names);
      
      expect(emails[0]).toContain('john');
      expect(emails[1]).toContain('jane');
    });
  });

  describe('generateDates', () => {
    it('should generate the correct number of dates', () => {
      const dates = generator.generateDates(5);
      expect(dates).toHaveLength(5);
    });

    it('should generate valid date formats', () => {
      const dates = generator.generateDates(10);
      dates.forEach(date => {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(new Date(date)).not.toBeInstanceOf(Date);
        expect(new Date(date).toString()).not.toBe('Invalid Date');
      });
    });

    it('should generate dates within the specified range', () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2023-12-31');
      const dates = generator.generateDates(100, startDate, endDate);
      
      dates.forEach(date => {
        const dateObj = new Date(date);
        expect(dateObj.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(dateObj.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });
  });

  describe('generateNumbers', () => {
    it('should generate the correct number of numbers', () => {
      const numbers = generator.generateNumbers(5);
      expect(numbers).toHaveLength(5);
    });

    it('should generate integers when specified', () => {
      const numbers = generator.generateNumbers(10, 1, 100, 'integer');
      numbers.forEach(num => {
        expect(Number.isInteger(num)).toBe(true);
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(100);
      });
    });

    it('should generate decimals when specified', () => {
      const numbers = generator.generateNumbers(10, 1, 100, 'decimal');
      numbers.forEach(num => {
        expect(num).toBeGreaterThanOrEqual(1);
        expect(num).toBeLessThanOrEqual(100);
        expect(num.toString()).toMatch(/^\d+\.\d{2}$/);
      });
    });
  });

  describe('generateText', () => {
    it('should generate the correct number of text entries', () => {
      const texts = generator.generateText(5);
      expect(texts).toHaveLength(5);
    });

    it('should generate text with approximately the specified length', () => {
      const texts = generator.generateText(10, 50);
      texts.forEach(text => {
        expect(text.length).toBeGreaterThan(10);
        expect(text.length).toBeLessThan(100);
      });
    });

    it('should generate different text entries', () => {
      const texts1 = generator.generateText(100);
      const texts2 = generator.generateText(100);
      
      // Should have some overlap but not be identical
      const overlap = texts1.filter(text => texts2.includes(text));
      expect(overlap.length).toBeGreaterThan(0);
      expect(overlap.length).toBeLessThan(texts1.length);
    });
  });

  describe('generateTableData', () => {
    it('should generate data for all specified columns', () => {
      const tableName = 'users';
      const columns = ['id', 'name', 'email', 'age'];
      const targetRows = 5;
      
      const data = generator.generateTableData(tableName, columns, targetRows);
      
      expect(data).toHaveLength(targetRows);
      data.forEach(row => {
        expect(row).toHaveProperty('id');
        expect(row).toHaveProperty('name');
        expect(row).toHaveProperty('email');
        expect(row).toHaveProperty('age');
      });
    });

    it('should generate sequential IDs starting from 1', () => {
      const data = generator.generateTableData('test', ['id'], 5);
      
      data.forEach((row, index) => {
        expect(row.id).toBe(index + 1);
      });
    });

    it('should generate realistic data based on column names', () => {
      const columns = ['id', 'name', 'email', 'salary', 'department'];
      const data = generator.generateTableData('employees', columns, 3);
      
      data.forEach(row => {
        // Check name format
        expect(row.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
        
        // Check email format
        expect(row.email).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/);
        
        // Check salary is a reasonable number
        expect(typeof row.salary).toBe('number');
        expect(row.salary).toBeGreaterThan(30000);
        expect(row.salary).toBeLessThan(150000);
        
        // Check department is from the predefined list
        expect(typeof row.department).toBe('string');
        expect(row.department.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('DataGenerationService', () => {
  let service: DataGenerationService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      collection: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        insertOne: jest.fn(),
        deleteMany: jest.fn(),
      }),
    };
    service = new DataGenerationService(mockDb);
  });

  describe('startGeneration', () => {
    it('should return a generation ID', async () => {
      const datasetId = 'test-dataset';
      const config = {
        targetRows: 1000,
        preserveExisting: true,
        dataTypes: { names: true, emails: true, dates: true, numbers: true, text: true },
        patterns: { realistic: true, relationships: true, constraints: true },
      };

      const generationId = await service.startGeneration(datasetId, config);
      
      expect(generationId).toBeDefined();
      expect(typeof generationId).toBe('string');
      expect(generationId.length).toBeGreaterThan(0);
    });

    it('should store generation status', async () => {
      const datasetId = 'test-dataset';
      const config = {
        targetRows: 1000,
        preserveExisting: true,
        dataTypes: { names: true, emails: true, dates: true, numbers: true, text: true },
        patterns: { realistic: true, relationships: true, constraints: true },
      };

      const generationId = await service.startGeneration(datasetId, config);
      const status = service.getGenerationStatus(generationId);
      
      expect(status).toBeDefined();
      expect(status?.datasetId).toBe(datasetId);
      expect(status?.status).toBe('pending');
    });
  });

  describe('getGenerationStatus', () => {
    it('should return null for non-existent generation', () => {
      const status = service.getGenerationStatus('non-existent-id');
      expect(status).toBeNull();
    });
  });

  describe('rollbackGeneration', () => {
    it('should call deleteMany on generated_data collection', async () => {
      const mockDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 1 });
      mockDb.collection.mockReturnValue({
        deleteMany: mockDeleteMany,
      });

      const result = await service.rollbackGeneration('test-dataset');
      
      expect(mockDb.collection).toHaveBeenCalledWith('generated_data');
      expect(mockDeleteMany).toHaveBeenCalledWith({ datasetId: 'test-dataset' });
      expect(result).toBe(true);
    });

    it('should return false if no data was deleted', async () => {
      const mockDeleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
      mockDb.collection.mockReturnValue({
        deleteMany: mockDeleteMany,
      });

      const result = await service.rollbackGeneration('test-dataset');
      expect(result).toBe(false);
    });
  });

  describe('validateGeneratedData', () => {
    it('should return valid: false when no data is found', async () => {
      const mockFindOne = jest.fn().mockResolvedValue(null);
      mockDb.collection.mockReturnValue({
        findOne: mockFindOne,
      });

      const result = await service.validateGeneratedData('test-dataset');
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('No generated data found');
    });

    it('should validate data structure', async () => {
      const mockData = {
        data: {
          'users': [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
          ],
          'orders': [
            { id: 1, user_id: 1, amount: 100.50 },
            { id: 2, user_id: 2, amount: 200.75 },
          ],
        },
      };

      const mockFindOne = jest.fn().mockResolvedValue(mockData);
      mockDb.collection.mockReturnValue({
        findOne: mockFindOne,
      });

      const result = await service.validateGeneratedData('test-dataset');
      
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect inconsistent column structure', async () => {
      const mockData = {
        data: {
          'users': [
            { id: 1, name: 'John Doe' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' }, // Different columns
          ],
        },
      };

      const mockFindOne = jest.fn().mockResolvedValue(mockData);
      mockDb.collection.mockReturnValue({
        findOne: mockFindOne,
      });

      const result = await service.validateGeneratedData('test-dataset');
      
      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('inconsistent column count'))).toBe(true);
    });
  });
});
