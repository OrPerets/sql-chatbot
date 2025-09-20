import { NextResponse } from "next/server";
import {
  getQuestionById,
  updateQuestion,
  deleteQuestion,
} from "@/lib/questions";

interface RouteParams {
  params: { setId: string; questionId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const question = await getQuestionById(params.questionId);
    if (!question) {
      return NextResponse.json({ message: "Question not found" }, { status: 404 });
    }
    return NextResponse.json(question);
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const question = await updateQuestion(params.questionId, body);
    
    if (!question) {
      return NextResponse.json({ message: "Question not found" }, { status: 404 });
    }
    
    return NextResponse.json(question);
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const success = await deleteQuestion(params.questionId);
    if (!success) {
      return NextResponse.json({ message: "Question not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    );
  }
}