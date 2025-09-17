const { MongoClient } = require('mongodb');

/**
 * Test utilities for database operations and common test scenarios
 */

class TestUtils {
  /**
   * Create a test user in the database
   */
  static async createTestUser(db, userData = {}) {
    const defaultUser = {
      email: 'test@example.com',
      password: 'password123',
      role: 'student',
      createdAt: new Date(),
      ...userData
    };

    const result = await db.collection('users').insertOne(defaultUser);
    return { ...defaultUser, _id: result.insertedId };
  }

  /**
   * Create test questions in the database
   */
  static async createTestQuestions(db, count = 5) {
    const questions = [];
    for (let i = 1; i <= count; i++) {
      questions.push({
        id: i,
        question: `Test question ${i}`,
        difficulty: i <= 2 ? 'easy' : i <= 4 ? 'medium' : 'hard',
        points: i * 5,
        expected_keywords: ['SELECT', 'FROM', 'WHERE'],
        solution_example: `SELECT * FROM table${i} WHERE id = ${i};`,
        approved: true
      });
    }

    const result = await db.collection('questions').insertMany(questions);
    return questions.map((q, index) => ({ ...q, _id: result.insertedIds[index] }));
  }

  /**
   * Clean up all test data
   */
  static async cleanupTestData(db) {
    const collections = ['users', 'questions', 'userPoints'];
    
    for (const collection of collections) {
      try {
        await db.collection(collection).deleteMany({});
      } catch (error) {
        // Collection might not exist, ignore error
      }
    }
  }

  /**
   * Wait for a condition to be true (useful for async operations)
   */
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Generate mock request object for testing Express routes
   */
  static mockRequest(overrides = {}) {
    return {
      body: {},
      params: {},
      query: {},
      headers: {},
      ...overrides
    };
  }

  /**
   * Generate mock response object for testing Express routes
   */
  static mockResponse() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      sendStatus: jest.fn().mockReturnThis()
    };
    return res;
  }

  /**
   * Create a test database connection (alternative to global setup)
   */
  static async createTestConnection() {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    const connection = await MongoClient.connect(uri);
    const db = connection.db();
    
    return { mongod, connection, db };
  }

  /**
   * Generate random test data
   */
  static generateRandomString(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate random email for testing
   */
  static generateRandomEmail() {
    return `test_${this.generateRandomString(8)}@example.com`;
  }
}

module.exports = TestUtils;
