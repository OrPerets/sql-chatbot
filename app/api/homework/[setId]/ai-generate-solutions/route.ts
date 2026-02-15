import { NextResponse } from "next/server";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import { generateSolutionsBulk, type AISolutionInput } from "@/lib/ai-grading";
import { updateQuestion } from "@/lib/questions";
import { getHomeworkSetById } from "@/lib/homework";
import type { Question } from "@/app/homework/types";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

interface AIGenerateSolutionsRequest {
  questionIds?: string[]; // Optional - if empty, generate for all questions without solutions
  overwrite?: boolean; // If true, overwrite existing solutions
}

interface AIGenerateSolutionsResponse {
  success: boolean;
  results: Array<{
    questionId: string;
    sql: string;
    explanation?: string;
    saved: boolean;
  }>;
  totalGenerated: number;
  totalSaved: number;
  errors?: string[];
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = (await request.json()) as AIGenerateSolutionsRequest;
    const { questionIds, overwrite = false } = body;
    const { setId } = await params;

    if (!setId) {
      return NextResponse.json(
        { error: "setId is required" },
        { status: 400 }
      );
    }

    // Get homework set details (including background story with database schema)
    const homeworkSet = await getHomeworkSetById(setId);
    if (!homeworkSet) {
      return NextResponse.json(
        { error: "Homework set not found" },
        { status: 404 }
      );
    }

    // Get all questions for this homework set
    const questions = await getQuestionsByHomeworkSet(setId);
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions found for this homework set" },
        { status: 404 }
      );
    }

    // Filter questions to generate solutions for
    let questionsToProcess: Question[] = questions;
    
    if (questionIds && questionIds.length > 0) {
      // Generate for specific questions
      questionsToProcess = questions.filter((q) => questionIds.includes(q.id));
    } else if (!overwrite) {
      // Only generate for questions without solutions
      questionsToProcess = questions.filter((q) => !q.starterSql?.trim());
    }

    if (questionsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        totalGenerated: 0,
        totalSaved: 0,
        message: overwrite 
          ? "No questions to process" 
          : "All questions already have solutions",
      });
    }

    // Extract database schema from backgroundStory (contains table definitions)
    const databaseSchema = homeworkSet.backgroundStory || "";

    // Prepare inputs for AI generation
    const solutionInputs: AISolutionInput[] = questionsToProcess.map((q) => ({
      questionId: q.id,
      questionPrompt: q.prompt,
      questionInstructions: q.instructions || "",
      expectedSchema: q.expectedResultSchema || [],
      databaseSchema, // Pass the database schema to each question
    }));

    // Generate solutions using AI
    const aiResults = await generateSolutionsBulk(solutionInputs);

    // Save generated solutions to questions
    const errors: string[] = [];
    const savedResults: AIGenerateSolutionsResponse["results"] = [];

    for (const result of aiResults) {
      if (!result.sql.trim()) {
        errors.push(`Question ${result.questionId}: No SQL generated`);
        savedResults.push({
          questionId: result.questionId,
          sql: "",
          explanation: result.explanation,
          saved: false,
        });
        continue;
      }

      try {
        // Update the question with the generated solution
        const updated = await updateQuestion(result.questionId, {
          starterSql: result.sql,
        });

        if (updated) {
          savedResults.push({
            questionId: result.questionId,
            sql: result.sql,
            explanation: result.explanation,
            saved: true,
          });
        } else {
          errors.push(`Question ${result.questionId}: Failed to save`);
          savedResults.push({
            questionId: result.questionId,
            sql: result.sql,
            explanation: result.explanation,
            saved: false,
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push(`Question ${result.questionId}: ${message}`);
        savedResults.push({
          questionId: result.questionId,
          sql: result.sql,
          explanation: result.explanation,
          saved: false,
        });
      }
    }

    const totalSaved = savedResults.filter((r) => r.saved).length;

    const response: AIGenerateSolutionsResponse = {
      success: true,
      results: savedResults,
      totalGenerated: aiResults.length,
      totalSaved,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("AI solution generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate solutions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
