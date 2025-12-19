import OpenAI from 'openai';
import type { Submission, Question, SqlAnswer, Feedback } from '@/app/homework/types';

/**
 * AI Analysis Framework for Student Submissions
 * 
 * This module provides AI-powered analysis of student SQL submissions to identify
 * failed questions, error patterns, and generate personalized feedback.
 */

export interface AnalysisResult {
  id: string;
  submissionId: string;
  studentId: string;
  homeworkSetId: string;
  analysisType: 'failure_analysis' | 'pattern_recognition' | 'feedback_generation';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence: number; // 0-1 scale
  results: {
    failedQuestions: FailedQuestionAnalysis[];
    errorPatterns: ErrorPattern[];
    topicMapping: TopicMapping[];
    recommendations: ImprovementRecommendation[];
    summary: string;
  };
  metadata: {
    processingTimeMs: number;
    modelUsed: string;
    promptVersion: string;
    createdAt: string;
    completedAt?: string;
  };
}

export interface FailedQuestionAnalysis {
  questionId: string;
  questionPrompt: string;
  studentAnswer: SqlAnswer;
  failureReasons: string[];
  confidence: number;
  suggestedFix?: string;
  topicAreas: string[];
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  description: string;
  examples: string[];
  severity: 'low' | 'medium' | 'high';
  relatedTopics: string[];
}

export interface TopicMapping {
  topic: string;
  questions: string[];
  successRate: number;
  commonErrors: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ImprovementRecommendation {
  type: 'study_topic' | 'practice_exercise' | 'concept_review' | 'syntax_fix';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  resources?: string[];
  estimatedTime: string;
}

export interface AnalysisRequest {
  submissionId: string;
  analysisTypes?: ('failure_analysis' | 'pattern_recognition' | 'feedback_generation')[];
  includeDetailedFeedback?: boolean;
  customPrompts?: Record<string, string>;
}

export class AIAnalysisService {
  private openai: OpenAI;
  private model: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  /**
   * Analyze a student submission for failures and patterns
   */
  async analyzeSubmission(
    submission: Submission,
    questions: Question[],
    request: AnalysisRequest
  ): Promise<AnalysisResult> {
    const startTime = Date.now();
    const analysisId = this.generateAnalysisId();

    try {
      // Extract failed questions
      const failedQuestions = this.extractFailedQuestions(submission, questions);
      
      // Generate AI analysis
      const aiAnalysis = await this.performAIAnalysis(submission, questions, failedQuestions, request);
      
      // Process results
      const results = this.processAnalysisResults(aiAnalysis, failedQuestions);
      
      const processingTime = Date.now() - startTime;
      
      return {
        id: analysisId,
        submissionId: submission.id,
        studentId: submission.studentId,
        homeworkSetId: submission.homeworkSetId,
        analysisType: 'failure_analysis',
        status: 'completed',
        confidence: this.calculateConfidence(results),
        results,
        metadata: {
          processingTimeMs: processingTime,
          modelUsed: this.model,
          promptVersion: '1.0',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('AI Analysis failed:', error);
      
      return {
        id: analysisId,
        submissionId: submission.id,
        studentId: submission.studentId,
        homeworkSetId: submission.homeworkSetId,
        analysisType: 'failure_analysis',
        status: 'failed',
        confidence: 0,
        results: {
          failedQuestions: [],
          errorPatterns: [],
          topicMapping: [],
          recommendations: [],
          summary: 'Analysis failed due to technical error.',
        },
        metadata: {
          processingTimeMs: Date.now() - startTime,
          modelUsed: this.model,
          promptVersion: '1.0',
          createdAt: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Extract failed questions from submission
   */
  private extractFailedQuestions(submission: Submission, questions: Question[]): FailedQuestionAnalysis[] {
    const failedQuestions: FailedQuestionAnalysis[] = [];

    for (const question of questions) {
      const answer = submission.answers[question.id];
      if (!answer || !answer.feedback) continue;

      // Consider a question failed if score is below 70% of max points
      const maxPoints = question.points || 10;
      const earnedPoints = answer.feedback.score || 0;
      const successThreshold = maxPoints * 0.7;

      if (earnedPoints < successThreshold) {
        failedQuestions.push({
          questionId: question.id,
          questionPrompt: question.prompt,
          studentAnswer: answer,
          failureReasons: this.extractFailureReasons(answer.feedback),
          confidence: 0.8, // Will be refined by AI analysis
          topicAreas: this.extractTopicAreas(question),
        });
      }
    }

    return failedQuestions;
  }

  /**
   * Extract failure reasons from feedback
   */
  private extractFailureReasons(feedback: Feedback): string[] {
    const reasons: string[] = [];
    
    if (feedback.autoNotes) {
      reasons.push(feedback.autoNotes);
    }
    
    if (feedback.instructorNotes) {
      reasons.push(feedback.instructorNotes);
    }
    
    // Analyze rubric breakdown for specific issues
    for (const entry of feedback.rubricBreakdown) {
      if (entry.earned === 0 && entry.comments) {
        reasons.push(entry.comments);
      }
    }
    
    return reasons;
  }

  /**
   * Extract topic areas from question
   */
  private extractTopicAreas(question: Question): string[] {
    const topics: string[] = [];
    const prompt = question.prompt.toLowerCase();
    const instructions = question.instructions?.toLowerCase() || '';
    
    // Basic topic detection based on keywords
    const topicKeywords = {
      'SELECT': ['select', 'query', 'retrieve'],
      'JOIN': ['join', 'inner join', 'left join', 'right join', 'outer join'],
      'WHERE': ['where', 'filter', 'condition'],
      'GROUP BY': ['group by', 'aggregate', 'count', 'sum', 'avg'],
      'ORDER BY': ['order by', 'sort', 'asc', 'desc'],
      'HAVING': ['having', 'group condition'],
      'SUBQUERY': ['subquery', 'nested', 'inner select'],
      'UNION': ['union', 'combine'],
      'WINDOW FUNCTIONS': ['window', 'over', 'partition', 'row_number'],
    };
    
    // Always include SELECT as a base topic for SQL queries
    let hasSelect = false;
    
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => prompt.includes(keyword) || instructions.includes(keyword))) {
        topics.push(topic);
        if (topic === 'SELECT') {
          hasSelect = true;
        }
      }
    }
    
    // If no specific topics found, return GENERAL SQL
    if (topics.length === 0) {
      return ['GENERAL SQL'];
    }
    
    // If we found other topics but not SELECT, add it as a base topic
    if (!hasSelect && topics.length > 0) {
      topics.unshift('SELECT');
    }
    
    return topics;
  }

  /**
   * Perform AI analysis using OpenAI
   */
  private async performAIAnalysis(
    submission: Submission,
    questions: Question[],
    failedQuestions: FailedQuestionAnalysis[],
    request: AnalysisRequest
  ): Promise<any> {
    const prompt = this.buildAnalysisPrompt(submission, questions, failedQuestions, request);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  /**
   * Build analysis prompt for OpenAI
   */
  private buildAnalysisPrompt(
    submission: Submission,
    questions: Question[],
    failedQuestions: FailedQuestionAnalysis[],
    request: AnalysisRequest
  ): string {
    const failedQuestionsData = failedQuestions.map(fq => ({
      questionId: fq.questionId,
      prompt: fq.questionPrompt,
      studentSQL: fq.studentAnswer.sql,
      feedback: fq.studentAnswer.feedback,
      failureReasons: fq.failureReasons,
      topicAreas: fq.topicAreas,
    }));

    return `
Analyze this student's SQL homework submission and provide detailed failure analysis, error patterns, and improvement recommendations.

STUDENT SUBMISSION DATA:
- Student ID: ${submission.studentId}
- Homework Set ID: ${submission.homeworkSetId}
- Overall Score: ${submission.overallScore}
- Status: ${submission.status}
- Attempt Number: ${submission.attemptNumber}

FAILED QUESTIONS:
${JSON.stringify(failedQuestionsData, null, 2)}

ALL QUESTIONS CONTEXT:
${questions.map(q => ({
  id: q.id,
  prompt: q.prompt,
  instructions: q.instructions,
  points: q.points,
  maxAttempts: q.maxAttempts,
})).map(q => JSON.stringify(q, null, 2)).join('\n\n')}

Please provide a JSON response with the following structure:
{
  "errorPatterns": [
    {
      "pattern": "string",
      "frequency": number,
      "description": "string",
      "examples": ["string"],
      "severity": "low|medium|high",
      "relatedTopics": ["string"]
    }
  ],
  "topicMapping": [
    {
      "topic": "string",
      "questions": ["string"],
      "successRate": number,
      "commonErrors": ["string"],
      "difficulty": "beginner|intermediate|advanced"
    }
  ],
  "recommendations": [
    {
      "type": "study_topic|practice_exercise|concept_review|syntax_fix",
      "priority": "low|medium|high",
      "title": "string",
      "description": "string",
      "resources": ["string"],
      "estimatedTime": "string"
    }
  ],
  "summary": "string"
}

Focus on:
1. Identifying common SQL syntax and logical errors
2. Mapping failures to specific SQL concepts and topics
3. Providing actionable improvement recommendations
4. Assessing difficulty levels and learning gaps
5. Suggesting specific study resources and practice areas

Be specific, constructive, and educational in your analysis.
`;
  }

  /**
   * Get system prompt for AI analysis
   */
  private getSystemPrompt(): string {
    return `You are an expert SQL instructor and educational analyst. Your role is to analyze student SQL homework submissions and provide detailed, constructive feedback to help students improve their SQL skills.

Key responsibilities:
1. Identify specific SQL errors and misconceptions
2. Map failures to learning topics and concepts
3. Provide actionable improvement recommendations
4. Assess student progress and learning gaps
5. Suggest appropriate study resources and practice exercises

Guidelines:
- Be constructive and encouraging, not critical
- Focus on learning and improvement, not just error identification
- Provide specific, actionable recommendations
- Consider the student's current skill level
- Suggest appropriate difficulty levels for practice
- Include estimated time for improvement activities

Always respond with valid JSON in the exact format requested.`;
  }

  /**
   * Process AI analysis results
   */
  private processAnalysisResults(aiAnalysis: any, failedQuestions: FailedQuestionAnalysis[]): AnalysisResult['results'] {
    return {
      failedQuestions: failedQuestions.map(fq => ({
        ...fq,
        confidence: Math.min(0.95, fq.confidence + 0.1), // Boost confidence after AI analysis
        suggestedFix: this.generateSuggestedFix(fq),
      })),
      errorPatterns: aiAnalysis.errorPatterns || [],
      topicMapping: aiAnalysis.topicMapping || [],
      recommendations: aiAnalysis.recommendations || [],
      summary: aiAnalysis.summary || 'Analysis completed successfully.',
    };
  }

  /**
   * Generate suggested fix for failed question
   */
  private generateSuggestedFix(failedQuestion: FailedQuestionAnalysis): string {
    const sql = failedQuestion.studentAnswer.sql;
    const reasons = failedQuestion.failureReasons;
    const topicAreas = failedQuestion.topicAreas;
    
    // Check topic areas first, then failure reasons
    if (topicAreas.includes('JOIN')) {
      return 'Review JOIN syntax and table relationships. Ensure proper ON conditions.';
    }
    
    if (topicAreas.includes('GROUP BY')) {
      return 'When using GROUP BY, ensure all non-aggregated columns are included in the GROUP BY clause.';
    }
    
    // Basic fix suggestions based on common errors
    if (reasons.some(r => r.toLowerCase().includes('syntax'))) {
      return 'Review SQL syntax fundamentals. Check for missing commas, parentheses, or keywords.';
    }
    
    if (reasons.some(r => r.toLowerCase().includes('join'))) {
      return 'Review JOIN syntax and table relationships. Ensure proper ON conditions.';
    }
    
    if (reasons.some(r => r.toLowerCase().includes('group by'))) {
      return 'When using GROUP BY, ensure all non-aggregated columns are included in the GROUP BY clause.';
    }
    
    return 'Review the question requirements and compare with your SQL query structure.';
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(results: AnalysisResult['results']): number {
    if (results.failedQuestions.length === 0) return 0.9;
    
    const avgQuestionConfidence = results.failedQuestions.reduce(
      (sum, fq) => sum + fq.confidence, 0
    ) / results.failedQuestions.length;
    
    const patternConfidence = results.errorPatterns.length > 0 ? 0.8 : 0.6;
    const recommendationConfidence = results.recommendations.length > 0 ? 0.8 : 0.6;
    
    return (avgQuestionConfidence + patternConfidence + recommendationConfidence) / 3;
  }

  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Batch analyze multiple submissions
   */
  async batchAnalyzeSubmissions(
    submissions: Submission[],
    questions: Question[],
    request: Omit<AnalysisRequest, 'submissionId'>
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    
    for (const submission of submissions) {
      try {
        const analysis = await this.analyzeSubmission(submission, questions, {
          ...request,
          submissionId: submission.id,
        });
        results.push(analysis);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to analyze submission ${submission.id}:`, error);
        // Continue with other submissions
      }
    }
    
    return results;
  }
}

/**
 * Static service instance
 */
let aiAnalysisService: AIAnalysisService | null = null;

export function getAIAnalysisService(): AIAnalysisService {
  if (!aiAnalysisService) {
    aiAnalysisService = new AIAnalysisService();
  }
  return aiAnalysisService;
}
