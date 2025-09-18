import { NextResponse } from "next/server";
import { getHomeworkQuestions, upsertQuestion } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const questions = getHomeworkQuestions(params.setId);
  return NextResponse.json(questions);
}

export async function POST(request: Request, { params }: RouteParams) {
  const payload = await request.json();
  const question = upsertQuestion(params.setId, payload);
  if (!question) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(question, { status: 201 });
}
