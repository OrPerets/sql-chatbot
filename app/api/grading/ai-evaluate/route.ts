import { NextResponse } from "next/server";
import { getSubmissionSummaries, getSubmissionById, gradeSubmission } from "@/lib/submissions";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import { evaluateSubmission, type AIGradingInput, type BulkGradingResult } from "@/lib/ai-grading";
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

// Vercel Hobby plan max is 60s; upgrade plan or use background jobs for longer runs
export const maxDuration = 60;
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
    
    // Process submissions one by one, saving each to DB immediately after grading
    const results: BulkGradingResult[] = [];
    let totalQuestionsGraded = 0;
    const total = submissionsWithAnswers.length;

    for (let i = 0; i < submissionsWithAnswers.length; i++) {
      const submissionData = submissionsWithAnswers[i];
      
      try {
        console.log(`[AI Grading] Processing submission ${i + 1}/${total}: ${submissionData.submissionId}`);
        
        // Grade this submission
        const gradingResult = await evaluateSubmission(
          submissionData.submissionId,
          submissionData.studentId,
          submissionData.answers
        );
        
        // Get the full submission to update it
        const submission = await getSubmissionById(submissionData.submissionId);
        if (!submission) {
          errors.push(`Submission ${submissionData.submissionId} not found for saving`);
          continue;
        }

        // Build updated answers with AI grades
        const updatedAnswers: Submission["answers"] = { ...submission.answers };

        for (const aiResult of gradingResult.results) {
          const answer = submission.answers[aiResult.questionId] as SqlAnswer | undefined;
          if (!answer) continue;

          // Use AI comment if there's no existing instructor note
          const existingInstructorNotes = answer.feedback?.instructorNotes?.trim();
          const aiComment = aiResult.comment?.trim() || "";
          
          const notesToSave = (existingInstructorNotes && existingInstructorNotes.trim()) 
            ? existingInstructorNotes 
            : (aiComment && aiComment.trim() ? aiComment : "");

          updatedAnswers[aiResult.questionId] = {
            ...answer,
            feedback: {
              questionId: aiResult.questionId,
              score: aiResult.score,
              autoNotes: answer.feedback?.autoNotes || "",
              instructorNotes: notesToSave,
              rubricBreakdown: answer.feedback?.rubricBreakdown || [],
            },
          };
        }

        // Calculate overall score
        const overallScore = Object.values(updatedAnswers).reduce(
          (sum, ans) => sum + (ans.feedback?.score ?? 0),
          0
        );

        // Save to database immediately
        console.log(`[AI Grading] Saving submission ${submissionData.submissionId} to database...`);
        const saved = await gradeSubmission(submissionData.submissionId, {
          answers: updatedAnswers,
          overallScore,
          status: "graded",
        });

        if (saved) {
          console.log(`[AI Grading] ✅ Successfully saved submission ${submissionData.submissionId}`);
          results.push(gradingResult);
          totalQuestionsGraded += gradingResult.results.length;
        } else {
          errors.push(`Failed to save submission ${submissionData.submissionId}`);
          console.error(`[AI Grading] ❌ Failed to save submission ${submissionData.submissionId}`);
        }

        console.log(`[AI Grading] Progress: ${i + 1}/${total} submissions (${results.length} saved)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Error processing submission ${submissionData.submissionId}: ${message}`);
        console.error(`[AI Grading] ❌ Error processing submission ${submissionData.submissionId}:`, err);
      }
    }

    console.log(`[AI Grading] Completed: ${results.length}/${total} submissions saved successfully`);

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
