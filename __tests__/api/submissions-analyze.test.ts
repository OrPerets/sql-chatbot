/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/submissions/[setId]/analyze/route';

// Mock the services
jest.mock('@/lib/ai-analysis');
jest.mock('@/lib/analysis-service');
jest.mock('@/lib/submissions');
jest.mock('@/lib/questions');

const mockAIAnalysisService = {
  analyzeSubmission: jest.fn()
};

const mockAnalysisService = {
  getAnalysisResultsForSubmission: jest.fn(),
  saveAnalysisResult: jest.fn()
};

const mockSubmissionsService = {
  getSubmissionById: jest.fn()
};

const mockQuestionsService = {
  getQuestionsForHomeworkSet: jest.fn()
};

jest.mock('@/lib/ai-analysis', () => ({
  getAIAnalysisService: () => mockAIAnalysisService
}));

jest.mock('@/lib/analysis-service', () => ({
  getAnalysisService: () => mockAnalysisService,
  saveAnalysisResult: jest.fn()
}));

jest.mock('@/lib/submissions', () => ({
  getSubmissionsService: () => mockSubmissionsService
}));

jest.mock('@/lib/questions', () => ({
  getQuestionsService: () => mockQuestionsService
}));

describe('/api/submissions/[setId]/analyze', () => {
  const mockSubmission = {
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
          autoNotes: 'Missing WHERE clause',
          rubricBreakdown: []
        }
      }
    },
    overallScore: 30,
    status: 'submitted',
    submittedAt: '2024-01-15T10:00:00Z'
  };

  const mockQuestions = [
    {
      id: 'question-1',
      prompt: 'Find all users',
      instructions: 'Write a query to retrieve all users',
      expectedResultSchema: [],
      gradingRubric: [],
      datasetId: 'dataset-1',
      maxAttempts: 3,
      points: 10,
      evaluationMode: 'auto',
      homeworkSetId: 'homework-1'
    }
  ];

  const mockAnalysisResult = {
    id: 'analysis-1',
    submissionId: 'submission-1',
    studentId: 'student-1',
    homeworkSetId: 'homework-1',
    analysisType: 'failure_analysis',
    status: 'completed',
    confidence: 0.85,
    results: {
      failedQuestions: [
        {
          questionId: 'question-1',
          questionPrompt: 'Find all users',
          studentAnswer: mockSubmission.answers['question-1'],
          failureReasons: ['Missing WHERE clause'],
          confidence: 0.8,
          topicAreas: ['SELECT']
        }
      ],
      errorPatterns: [
        {
          pattern: 'Missing WHERE clause',
          frequency: 1,
          description: 'Queries without proper filtering',
          examples: ['SELECT * FROM users'],
          severity: 'medium',
          relatedTopics: ['WHERE', 'FILTERING']
        }
      ],
      topicMapping: [],
      recommendations: [
        {
          type: 'study_topic',
          priority: 'high',
          title: 'Learn WHERE clause usage',
          description: 'Practice filtering data with WHERE conditions',
          resources: ['SQL Basics Tutorial'],
          estimatedTime: '2 hours'
        }
      ],
      summary: 'Student needs to work on filtering queries'
    },
    metadata: {
      processingTimeMs: 1500,
      modelUsed: 'gpt-4o-mini',
      promptVersion: '1.0',
      createdAt: '2024-01-15T10:05:00Z',
      completedAt: '2024-01-15T10:05:01Z'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should analyze a submission successfully', async () => {
      mockSubmissionsService.getSubmissionById.mockResolvedValue(mockSubmission);
      mockQuestionsService.getQuestionsForHomeworkSet.mockResolvedValue(mockQuestions);
      mockAnalysisService.getAnalysisResultsForSubmission.mockResolvedValue([]);
      mockAIAnalysisService.analyzeSubmission.mockResolvedValue(mockAnalysisResult);
      mockAnalysisService.saveAnalysisResult.mockResolvedValue(mockAnalysisResult);

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze', {
        method: 'POST',
        body: JSON.stringify({
          submissionId: 'submission-1',
          analysisTypes: ['failure_analysis'],
          includeDetailedFeedback: true
        })
      });

      const response = await POST(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Analysis completed successfully');
      expect(data.analysis).toBeDefined();
      expect(data.analysis.id).toBe('analysis-1');
      expect(data.analysis.status).toBe('completed');
      expect(mockAIAnalysisService.analyzeSubmission).toHaveBeenCalledWith(
        mockSubmission,
        mockQuestions,
        expect.objectContaining({
          submissionId: 'submission-1',
          analysisTypes: ['failure_analysis'],
          includeDetailedFeedback: true
        })
      );
    });

    it('should return 400 for missing homework set ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/submissions//analyze', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request, { params: { setId: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Homework set ID is required');
    });

    it('should return 404 for non-existent submission', async () => {
      mockSubmissionsService.getSubmissionById.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze', {
        method: 'POST',
        body: JSON.stringify({
          submissionId: 'nonexistent'
        })
      });

      const response = await POST(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Submission not found');
    });

    it('should return 404 for homework set with no questions', async () => {
      mockSubmissionsService.getSubmissionById.mockResolvedValue(mockSubmission);
      mockQuestionsService.getQuestionsForHomeworkSet.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze', {
        method: 'POST',
        body: JSON.stringify({
          submissionId: 'submission-1'
        })
      });

      const response = await POST(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No questions found for this homework set');
    });

    it('should return existing analysis if already exists and force is false', async () => {
      mockSubmissionsService.getSubmissionById.mockResolvedValue(mockSubmission);
      mockQuestionsService.getQuestionsForHomeworkSet.mockResolvedValue(mockQuestions);
      mockAnalysisService.getAnalysisResultsForSubmission.mockResolvedValue([mockAnalysisResult]);

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze', {
        method: 'POST',
        body: JSON.stringify({
          submissionId: 'submission-1'
        })
      });

      const response = await POST(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Analysis already exists for this submission');
      expect(data.existingAnalyses).toBeDefined();
      expect(data.existingAnalyses).toHaveLength(1);
      expect(mockAIAnalysisService.analyzeSubmission).not.toHaveBeenCalled();
    });

    it('should force new analysis when force is true', async () => {
      mockSubmissionsService.getSubmissionById.mockResolvedValue(mockSubmission);
      mockQuestionsService.getQuestionsForHomeworkSet.mockResolvedValue(mockQuestions);
      mockAnalysisService.getAnalysisResultsForSubmission.mockResolvedValue([mockAnalysisResult]);
      mockAIAnalysisService.analyzeSubmission.mockResolvedValue(mockAnalysisResult);
      mockAnalysisService.saveAnalysisResult.mockResolvedValue(mockAnalysisResult);

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze', {
        method: 'POST',
        body: JSON.stringify({
          submissionId: 'submission-1',
          force: true
        })
      });

      const response = await POST(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Analysis completed successfully');
      expect(mockAIAnalysisService.analyzeSubmission).toHaveBeenCalled();
    });

    it('should handle analysis errors gracefully', async () => {
      mockSubmissionsService.getSubmissionById.mockResolvedValue(mockSubmission);
      mockQuestionsService.getQuestionsForHomeworkSet.mockResolvedValue(mockQuestions);
      mockAnalysisService.getAnalysisResultsForSubmission.mockResolvedValue([]);
      mockAIAnalysisService.analyzeSubmission.mockRejectedValue(new Error('AI Analysis failed'));

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze', {
        method: 'POST',
        body: JSON.stringify({
          submissionId: 'submission-1'
        })
      });

      const response = await POST(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to analyze submission');
      expect(data.details).toBe('AI Analysis failed');
    });
  });

  describe('GET', () => {
    it('should retrieve analysis results for a submission', async () => {
      mockAnalysisService.getAnalysisResultsForSubmission.mockResolvedValue([mockAnalysisResult]);

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze?submissionId=submission-1');

      const response = await GET(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.homeworkSetId).toBe('homework-1');
      expect(data.submissionId).toBe('submission-1');
      expect(data.analyses).toBeDefined();
      expect(data.analyses).toHaveLength(1);
      expect(data.analyses[0].id).toBe('analysis-1');
      expect(mockAnalysisService.getAnalysisResultsForSubmission).toHaveBeenCalledWith('submission-1');
    });

    it('should return 400 for missing homework set ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/submissions//analyze');

      const response = await GET(request, { params: { setId: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Homework set ID is required');
    });

    it('should handle service errors gracefully', async () => {
      mockAnalysisService.getAnalysisResultsForSubmission.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze?submissionId=submission-1');

      const response = await GET(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to retrieve analysis results');
      expect(data.details).toBe('Database error');
    });

    it('should return empty array for submission with no analyses', async () => {
      mockAnalysisService.getAnalysisResultsForSubmission.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/submissions/homework-1/analyze?submissionId=submission-1');

      const response = await GET(request, { params: { setId: 'homework-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.homeworkSetId).toBe('homework-1');
      expect(data.submissionId).toBe('submission-1');
      expect(data.analyses).toHaveLength(0);
    });
  });
});
