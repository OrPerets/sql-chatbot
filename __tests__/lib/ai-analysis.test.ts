import { AIAnalysisService } from '@/lib/ai-analysis';
import type { Submission, Question, SqlAnswer, Feedback } from '@/app/homework/types';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  errorPatterns: [
                    {
                      pattern: "Missing WHERE clause",
                      frequency: 3,
                      description: "Queries without proper filtering",
                      examples: ["SELECT * FROM users", "SELECT name FROM products"],
                      severity: "medium",
                      relatedTopics: ["WHERE", "FILTERING"]
                    }
                  ],
                  topicMapping: [
                    {
                      topic: "SELECT",
                      questions: ["q1", "q2"],
                      successRate: 0.6,
                      commonErrors: ["Missing WHERE clause"],
                      difficulty: "beginner"
                    }
                  ],
                  recommendations: [
                    {
                      type: "study_topic",
                      priority: "high",
                      title: "Learn WHERE clause usage",
                      description: "Practice filtering data with WHERE conditions",
                      resources: ["SQL Basics Tutorial", "WHERE clause exercises"],
                      estimatedTime: "2 hours"
                    }
                  ],
                  summary: "Student shows good understanding of basic SELECT but needs work on filtering."
                })
              }
            }]
          })
        }
      }
    }))
  };
});

describe('AIAnalysisService', () => {
  let aiService: AIAnalysisService;
  let mockSubmission: Submission;
  let mockQuestions: Question[];

  beforeEach(() => {
    aiService = new AIAnalysisService();
    
    // Mock submission data
    mockSubmission = {
      id: 'submission-1',
      homeworkSetId: 'homework-1',
      studentId: 'student-1',
      attemptNumber: 1,
      answers: {
        'question-1': {
          sql: 'SELECT * FROM users',
          feedback: {
            questionId: 'question-1',
            score: 3,
            autoNotes: 'Missing WHERE clause for filtering',
            rubricBreakdown: []
          }
        },
        'question-2': {
          sql: 'SELECT name, email FROM users WHERE active = 1',
          feedback: {
            questionId: 'question-2',
            score: 8,
            autoNotes: 'Good query with proper filtering',
            rubricBreakdown: []
          }
        }
      },
      overallScore: 55,
      status: 'submitted',
      submittedAt: '2024-01-15T10:00:00Z'
    };

    // Mock questions data
    mockQuestions = [
      {
        id: 'question-1',
        prompt: 'Find all users in the database',
        instructions: 'Write a query to retrieve all user records',
        expectedResultSchema: [
          { column: 'id', type: 'integer' },
          { column: 'name', type: 'string' },
          { column: 'email', type: 'string' }
        ],
        gradingRubric: [],
        datasetId: 'dataset-1',
        maxAttempts: 3,
        points: 10,
        evaluationMode: 'auto',
        homeworkSetId: 'homework-1'
      },
      {
        id: 'question-2',
        prompt: 'Find active users only',
        instructions: 'Write a query to retrieve only active users',
        expectedResultSchema: [
          { column: 'name', type: 'string' },
          { column: 'email', type: 'string' }
        ],
        gradingRubric: [],
        datasetId: 'dataset-1',
        maxAttempts: 3,
        points: 10,
        evaluationMode: 'auto',
        homeworkSetId: 'homework-1'
      }
    ];
  });

  describe('analyzeSubmission', () => {
    it('should analyze a submission and return analysis results', async () => {
      const analysisRequest = {
        submissionId: 'submission-1',
        analysisTypes: ['failure_analysis'],
        includeDetailedFeedback: true
      };

      const result = await aiService.analyzeSubmission(mockSubmission, mockQuestions, analysisRequest);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.submissionId).toBe('submission-1');
      expect(result.studentId).toBe('student-1');
      expect(result.homeworkSetId).toBe('homework-1');
      expect(result.status).toBe('completed');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.results).toBeDefined();
      expect(result.results.failedQuestions).toBeDefined();
      expect(result.results.errorPatterns).toBeDefined();
      expect(result.results.recommendations).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should identify failed questions correctly', async () => {
      const analysisRequest = {
        submissionId: 'submission-1',
        analysisTypes: ['failure_analysis']
      };

      const result = await aiService.analyzeSubmission(mockSubmission, mockQuestions, analysisRequest);

      // Question 1 should be identified as failed (score 3 < 7 threshold)
      const failedQuestion = result.results.failedQuestions.find(fq => fq.questionId === 'question-1');
      expect(failedQuestion).toBeDefined();
      expect(failedQuestion?.failureReasons).toContain('Missing WHERE clause for filtering');
      expect(failedQuestion?.confidence).toBeGreaterThan(0);
    });

    it('should not identify successful questions as failed', async () => {
      const analysisRequest = {
        submissionId: 'submission-1',
        analysisTypes: ['failure_analysis']
      };

      const result = await aiService.analyzeSubmission(mockSubmission, mockQuestions, analysisRequest);

      // Question 2 should not be identified as failed (score 8 >= 7 threshold)
      const failedQuestion = result.results.failedQuestions.find(fq => fq.questionId === 'question-2');
      expect(failedQuestion).toBeUndefined();
    });

    it('should handle submissions with no failed questions', async () => {
      const successfulSubmission = {
        ...mockSubmission,
        answers: {
          'question-1': {
            sql: 'SELECT * FROM users WHERE active = 1',
            feedback: {
              questionId: 'question-1',
              score: 9,
              autoNotes: 'Excellent query',
              rubricBreakdown: []
            }
          },
          'question-2': {
            sql: 'SELECT name, email FROM users WHERE active = 1',
            feedback: {
              questionId: 'question-2',
              score: 10,
              autoNotes: 'Perfect query',
              rubricBreakdown: []
            }
          }
        }
      };

      const analysisRequest = {
        submissionId: 'submission-1',
        analysisTypes: ['failure_analysis']
      };

      const result = await aiService.analyzeSubmission(successfulSubmission, mockQuestions, analysisRequest);

      expect(result.results.failedQuestions).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      // Get the mocked OpenAI instance
      const MockOpenAI = require('openai').default;
      const mockInstance = new MockOpenAI();
      
      // Mock the create method to throw an error
      mockInstance.chat.completions.create = jest.fn().mockRejectedValueOnce(new Error('API Error'));

      // Create a new service instance and replace its OpenAI instance
      const errorService = new AIAnalysisService();
      (errorService as any).openai = mockInstance;

      const analysisRequest = {
        submissionId: 'submission-1',
        analysisTypes: ['failure_analysis']
      };

      const result = await errorService.analyzeSubmission(mockSubmission, mockQuestions, analysisRequest);

      expect(result.status).toBe('failed');
      expect(result.confidence).toBe(0);
      expect(result.results.summary).toContain('Analysis failed due to technical error');
    });
  });

  describe('batchAnalyzeSubmissions', () => {
    it('should analyze multiple submissions', async () => {
      const submissions = [mockSubmission];
      const analysisRequest = {
        analysisTypes: ['failure_analysis'],
        includeDetailedFeedback: true
      };

      const results = await aiService.batchAnalyzeSubmissions(submissions, mockQuestions, analysisRequest);

      expect(results).toHaveLength(1);
      expect(results[0].submissionId).toBe('submission-1');
      expect(results[0].status).toBe('completed');
    });

    it('should handle empty submissions array', async () => {
      const analysisRequest = {
        analysisTypes: ['failure_analysis']
      };

      const results = await aiService.batchAnalyzeSubmissions([], mockQuestions, analysisRequest);

      expect(results).toHaveLength(0);
    });

    it('should continue processing even if some submissions fail', async () => {
      // Get the mocked OpenAI instance
      const MockOpenAI = require('openai').default;
      const mockInstance = new MockOpenAI();
      
      // Mock the create method to succeed once then fail
      mockInstance.chat.completions.create = jest.fn()
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                errorPatterns: [],
                topicMapping: [],
                recommendations: [],
                summary: 'Analysis completed'
              })
            }
          }]
        })
        .mockRejectedValueOnce(new Error('API Error'));

      // Create a new service instance and replace its OpenAI instance
      const batchService = new AIAnalysisService();
      (batchService as any).openai = mockInstance;

      const submissions = [mockSubmission, { ...mockSubmission, id: 'submission-2' }];
      const analysisRequest = {
        analysisTypes: ['failure_analysis']
      };

      const results = await batchService.batchAnalyzeSubmissions(submissions, mockQuestions, analysisRequest);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('completed');
      expect(results[1].status).toBe('failed');
    });
  });

  describe('extractTopicAreas', () => {
    it('should extract topic areas from question prompts', () => {
      const questionWithJoin: Question = {
        ...mockQuestions[0],
        prompt: 'Join users and orders tables to find user order history',
        instructions: 'Use INNER JOIN to combine the tables'
      };

      const result = aiService['extractTopicAreas'](questionWithJoin);

      expect(result).toContain('JOIN');
      expect(result).toContain('SELECT');
    });

    it('should extract GROUP BY topics', () => {
      const questionWithGroupBy: Question = {
        ...mockQuestions[0],
        prompt: 'Count the number of orders per user using GROUP BY',
        instructions: 'Use GROUP BY and COUNT functions'
      };

      const result = aiService['extractTopicAreas'](questionWithGroupBy);

      expect(result).toContain('GROUP BY');
      expect(result).toContain('SELECT');
    });

    it('should return GENERAL SQL for questions without specific keywords', () => {
      const genericQuestion: Question = {
        ...mockQuestions[0],
        prompt: 'Write something to get some data',
        instructions: 'Just write something'
      };

      const result = aiService['extractTopicAreas'](genericQuestion);

      expect(result).toContain('GENERAL SQL');
    });
  });

  describe('extractFailureReasons', () => {
    it('should extract failure reasons from feedback', () => {
      const feedback: Feedback = {
        questionId: 'question-1',
        score: 3,
        autoNotes: 'SQL syntax error',
        instructorNotes: 'Missing WHERE clause',
        rubricBreakdown: [
          {
            criterionId: 'criterion-1',
            earned: 0,
            comments: 'No filtering applied'
          }
        ]
      };

      const result = aiService['extractFailureReasons'](feedback);

      expect(result).toContain('SQL syntax error');
      expect(result).toContain('Missing WHERE clause');
      expect(result).toContain('No filtering applied');
    });

    it('should handle feedback with no failure reasons', () => {
      const feedback: Feedback = {
        questionId: 'question-1',
        score: 8,
        autoNotes: 'Good query',
        rubricBreakdown: []
      };

      const result = aiService['extractFailureReasons'](feedback);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Good query');
    });
  });

  describe('generateSuggestedFix', () => {
    it('should generate syntax-related fixes', () => {
      const failedQuestion = {
        questionId: 'question-1',
        questionPrompt: 'Find users',
        studentAnswer: {
          sql: 'SELECT * FROM users',
          feedback: {
            questionId: 'question-1',
            score: 3,
            autoNotes: 'SQL syntax error',
            rubricBreakdown: []
          }
        } as SqlAnswer,
        failureReasons: ['SQL syntax error'],
        confidence: 0.8,
        topicAreas: ['SELECT']
      };

      const result = aiService['generateSuggestedFix'](failedQuestion);

      expect(result).toContain('syntax');
    });

    it('should generate JOIN-related fixes', () => {
      const failedQuestion = {
        questionId: 'question-1',
        questionPrompt: 'Join tables',
        studentAnswer: {
          sql: 'SELECT * FROM users, orders',
          feedback: {
            questionId: 'question-1',
            score: 3,
            autoNotes: 'JOIN syntax error',
            rubricBreakdown: []
          }
        } as SqlAnswer,
        failureReasons: ['JOIN syntax error'],
        confidence: 0.8,
        topicAreas: ['JOIN']
      };

      const result = aiService['generateSuggestedFix'](failedQuestion);

      expect(result).toContain('JOIN');
    });

    it('should generate GROUP BY-related fixes', () => {
      const failedQuestion = {
        questionId: 'question-1',
        questionPrompt: 'Group data',
        studentAnswer: {
          sql: 'SELECT name, COUNT(*) FROM users',
          feedback: {
            questionId: 'question-1',
            score: 3,
            autoNotes: 'GROUP BY error',
            rubricBreakdown: []
          }
        } as SqlAnswer,
        failureReasons: ['GROUP BY error'],
        confidence: 0.8,
        topicAreas: ['GROUP BY']
      };

      const result = aiService['generateSuggestedFix'](failedQuestion);

      expect(result).toContain('GROUP BY');
    });
  });

  describe('calculateConfidence', () => {
    it('should calculate confidence based on analysis results', () => {
      const results = {
        failedQuestions: [
          { confidence: 0.8 } as any,
          { confidence: 0.9 } as any
        ],
        errorPatterns: [{ pattern: 'test' }],
        topicMapping: [],
        recommendations: [{ type: 'study' }],
        summary: 'Test summary'
      };

      const result = aiService['calculateConfidence'](results);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should return high confidence for no failed questions', () => {
      const results = {
        failedQuestions: [],
        errorPatterns: [],
        topicMapping: [],
        recommendations: [],
        summary: 'No issues found'
      };

      const result = aiService['calculateConfidence'](results);

      expect(result).toBe(0.9);
    });
  });
});
