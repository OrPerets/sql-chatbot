import { NextResponse } from "next/server";
import { getSubmissionSummaries, getSubmissionById } from "@/lib/submissions";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import { evaluateAnswer, type AIGradingInput } from "@/lib/ai-grading";
import type { Question, Submission, SqlAnswer } from "@/app/homework/types";

interface TestAIRequest {
  homeworkSetId: string;
  questionId: string;
}

interface TestAIResult {
  submissionId: string;
  studentId: string;
  studentName?: string;
  studentIdNumber?: string;
  sql: string;
  result: {
    score: number;
    comment: string;
    confidence: number;
    breakdown: {
      queryCorrectness: number;
      outputCorrectness: number;
    };
  };
}

interface TestAIResponse {
  success: boolean;
  questionId: string;
  questionPrompt: string;
  results: TestAIResult[];
  errors?: string[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TestAIRequest;
    const { homeworkSetId, questionId } = body;

    if (!homeworkSetId || !questionId) {
      return NextResponse.json(
        { error: "homeworkSetId and questionId are required" },
        { status: 400 }
      );
    }

    // Get the specific question
    const questions = await getQuestionsByHomeworkSet(homeworkSetId);
    const question = questions.find((q) => q.id === questionId);
    
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Get all submission summaries (to get student names)
    const summaries = await getSubmissionSummaries(homeworkSetId);
    const summariesById = new Map(summaries.map((s) => [s.id, s]));

    // Get all submissions and extract answers for this question
    const testResults: TestAIResult[] = [];
    const errors: string[] = [];

    for (const summary of summaries) {
      try {
        const submission = await getSubmissionById(summary.id);
        if (!submission) {
          errors.push(`Submission ${summary.id} not found`);
          continue;
        }

        const answer = submission.answers[questionId] as SqlAnswer | undefined;
        
        // Skip if no SQL was submitted
        if (!answer?.sql?.trim()) {
          continue;
        }

        // Prepare grading input
        const gradingInput: AIGradingInput = {
          questionId,
          questionPrompt: question.prompt,
          questionInstructions: question.instructions,
          referenceSql: question.starterSql,
          expectedSchema: question.expectedResultSchema || [],
          maxPoints: question.points || 10,
          rubricCriteria: (question.gradingRubric || []).map((r) => ({
            id: r.id,
            label: r.label,
            description: r.description,
            weight: r.weight,
          })),
          studentSql: answer.sql,
          studentResults: answer.resultPreview
            ? {
                columns: answer.resultPreview.columns,
                rows: answer.resultPreview.rows as Array<Record<string, unknown>>,
              }
            : undefined,
        };

        // Evaluate using AI (NOT saved to DB)
        const aiResult = await evaluateAnswer(gradingInput);

        testResults.push({
          submissionId: submission.id,
          studentId: submission.studentId,
          studentName: summary.studentName,
          studentIdNumber: summary.studentIdNumber,
          sql: answer.sql,
          result: {
            score: aiResult.score,
            comment: aiResult.comment,
            confidence: aiResult.confidence,
            breakdown: aiResult.breakdown,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error processing submission ${summary.id}: ${message}`);
      }
    }

    const response: TestAIResponse = {
      success: true,
      questionId: question.id,
      questionPrompt: question.prompt,
      results: testResults,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Test AI evaluation error:", error);
    return NextResponse.json(
      {
        error: "Failed to test AI evaluation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
