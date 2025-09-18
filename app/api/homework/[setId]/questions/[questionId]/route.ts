import { NextResponse } from "next/server";
import { deleteQuestion } from "../../../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string; questionId: string };
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const success = deleteQuestion(params.setId, params.questionId);
  if (!success) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
