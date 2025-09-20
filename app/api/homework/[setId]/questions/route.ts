import { NextResponse } from "next/server";
import {
  getQuestionsByHomeworkSet,
  createQuestion,
  getQuestionsService,
} from "@/lib/questions";
import type { Question } from "@/app/homework/types";

interface RouteParams {
  params: { setId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const questions = await getQuestionsByHomeworkSet(params.setId);
    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    
    const questionData: Omit<Question, 'id'> & { homeworkSetId: string } = {
      homeworkSetId: params.setId,
      prompt: body.prompt || "",
      instructions: body.instructions || "",
      starterSql: body.starterSql,
      expectedResultSchema: body.expectedResultSchema || [],
      gradingRubric: body.gradingRubric || [],
      datasetId: body.datasetId,
      maxAttempts: body.maxAttempts || 3,
      points: body.points || 10,
      evaluationMode: body.evaluationMode,
    };

    const question = await createQuestion(questionData);
    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const service = await getQuestionsService();
    const deletedCount = await service.deleteQuestionsByHomeworkSet(params.setId);
    return NextResponse.json({ 
      message: `Deleted ${deletedCount} questions`,
      deletedCount 
    });
  } catch (error) {
    console.error('Error deleting questions:', error);
    return NextResponse.json(
      { error: 'Failed to delete questions' },
      { status: 500 }
    );
  }
}