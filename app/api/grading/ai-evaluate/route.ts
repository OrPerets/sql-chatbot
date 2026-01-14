import { NextResponse } from "next/server";
import { getSubmissionSummaries, getSubmissionById } from "@/lib/submissions";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import { evaluateBulk, type AIGradingInput, type BulkGradingResult } from "@/lib/ai-grading";
import type { Question, Submission, SqlAnswer } from "@/app/homework/types";

interface AIEvaluateRequest {
  homeworkSetId: string;
  submissionIds?: string[];  // Optional - if empty, grade all ungraded
  additionalGradingInstructions?: string;  // Optional - additional instructions to append to each question
  limit?: number;  // Optional - limit number of submissions for debugging (default: no limit)
}

interface AIEvaluateResponse {
  success: boolean;
  results: BulkGradingResult[];
  totalSubmissions: number;
  totalQuestionsGraded: number;
  errors?: string[];
}

// Increase timeout for this route (AI grading can take a long time)
// Note: Vercel hobby plan max is 60 seconds. For longer execution, consider upgrading plan or using background jobs
export const maxDuration = 60; // 60 seconds (max for Vercel hobby plan)
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    console.log("[AI Grading] Starting evaluation...");
    const body = (await request.json()) as AIEvaluateRequest;
    const { homeworkSetId, submissionIds, additionalGradingInstructions, limit } = body;
    
    console.log("[AI Grading] Request:", { homeworkSetId, submissionCount: submissionIds?.length || "all", limit });

    if (!homeworkSetId) {
      return NextResponse.json(
        { error: "homeworkSetId is required" },
        { status: 400 }
      );
    }

    // Get all questions for this homework set
    const questions = await getQuestionsByHomeworkSet(homeworkSetId);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions found for this homework set" },
        { status: 404 }
      );
    }

    // Create a map of questions by ID for quick lookup
    const questionsById = new Map<string, Question>();
    questions.forEach((q) => questionsById.set(q.id, q));

    // Get submission summaries
    const summaries = await getSubmissionSummaries(homeworkSetId);
    if (summaries.length === 0) {
      return NextResponse.json(
        { error: "No submissions found for this homework set" },
        { status: 404 }
      );
    }

    // Filter submissions to grade
    let submissionsToGrade = summaries;
    if (submissionIds && submissionIds.length > 0) {
      // Grade specific submissions
      submissionsToGrade = summaries.filter((s) => submissionIds.includes(s.id));
    } else {
      // Grade all ungraded submissions (status is "submitted" or "in_progress")
      submissionsToGrade = summaries.filter((s) => s.status !== "graded");
    }
    
    // Apply limit for debugging if provided
    if (limit && limit > 0) {
      const originalCount = submissionsToGrade.length;
      submissionsToGrade = submissionsToGrade.slice(0, limit);
      console.log(`[AI Grading] Limited to ${submissionsToGrade.length} submissions (from ${originalCount} total) for debugging`);
    }

    if (submissionsToGrade.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        totalSubmissions: 0,
        totalQuestionsGraded: 0,
        message: "No submissions to grade",
      });
    }

    // Fetch full submission data and prepare for AI grading
    const submissionsWithAnswers: Array<{
      submissionId: string;
      studentId: string;
      answers: AIGradingInput[];
    }> = [];

    const errors: string[] = [];

    for (const summary of submissionsToGrade) {
      try {
        const submission = await getSubmissionById(summary.id);
        if (!submission) {
          errors.push(`Submission ${summary.id} not found`);
          continue;
        }

        // Prepare grading inputs for each answer
        const gradingInputs: AIGradingInput[] = [];

        for (const [questionId, answer] of Object.entries(submission.answers)) {
          const question = questionsById.get(questionId);
          if (!question) {
            errors.push(`Question ${questionId} not found for submission ${summary.id}`);
            continue;
          }

          const sqlAnswer = answer as SqlAnswer;
          
          // Skip if no SQL was submitted
          if (!sqlAnswer.sql?.trim()) {
            continue;
          }

          // Combine question instructions with additional grading instructions if provided
          let combinedInstructions = question.instructions;
          if (additionalGradingInstructions?.trim()) {
            combinedInstructions = `${question.instructions}\n\n## הנחיות נוספות להערכה\n${additionalGradingInstructions.trim()}`;
          }

          gradingInputs.push({
            questionId,
            questionPrompt: question.prompt,
            questionInstructions: combinedInstructions,
            referenceSql: question.starterSql,
            expectedSchema: question.expectedResultSchema || [],
            maxPoints: question.points || 10,
            rubricCriteria: (question.gradingRubric || []).map((r) => ({
              id: r.id,
              label: r.label,
              description: r.description,
              weight: r.weight,
            })),
            studentSql: sqlAnswer.sql,
            studentResults: sqlAnswer.resultPreview
              ? {
                  columns: sqlAnswer.resultPreview.columns,
                  rows: sqlAnswer.resultPreview.rows as Array<Record<string, unknown>>,
                }
              : undefined,
          });
        }

        if (gradingInputs.length > 0) {
          submissionsWithAnswers.push({
            submissionId: submission.id,
            studentId: submission.studentId,
            answers: gradingInputs,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error processing submission ${summary.id}: ${message}`);
      }
    }

    if (submissionsWithAnswers.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        totalSubmissions: 0,
        totalQuestionsGraded: 0,
        message: "No answers to grade",
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    console.log(`[AI Grading] Processing ${submissionsWithAnswers.length} submissions...`);
    
    // Run AI evaluation with progress logging
    const results = await evaluateBulk(submissionsWithAnswers, (completed, total) => {
      console.log(`[AI Grading] Progress: ${completed}/${total} submissions`);
    });

    console.log(`[AI Grading] Completed evaluation for ${results.length} submissions`);

    // Calculate totals
    const totalQuestionsGraded = results.reduce(
      (sum, r) => sum + r.results.length,
      0
    );

    const response: AIEvaluateResponse = {
      success: true,
      results,
      totalSubmissions: results.length,
      totalQuestionsGraded,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`[AI Grading] Returning response: ${results.length} submissions, ${totalQuestionsGraded} questions`);
    return NextResponse.json(response);
  } catch (error) {
    console.error("AI evaluation error:", error);
    return NextResponse.json(
      {
        error: "Failed to evaluate submissions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
