import { NextResponse } from "next/server";
import { saveQuestionAnalytics } from "@/lib/question-analytics";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.submissionId || !body?.questionId || !body?.studentId || !body?.homeworkSetId) {
      return NextResponse.json({ error: "Missing required analytics fields" }, { status: 400 });
    }

    await saveQuestionAnalytics(body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save question analytics", error);
    return NextResponse.json({ error: "Failed to save analytics" }, { status: 500 });
  }
}

