import { NextResponse } from "next/server";
import { getQuestionAnalyticsStats } from "@/lib/question-analytics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get("setId") ?? undefined;
    const questionId = searchParams.get("questionId") ?? undefined;
    const studentId = searchParams.get("studentId") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const stats = await getQuestionAnalyticsStats({ setId, questionId, studentId, from, to });

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Failed to fetch question analytics stats", error);
    return NextResponse.json({ error: "Failed to fetch question analytics stats" }, { status: 500 });
  }
}
