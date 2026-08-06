import { NextRequest, NextResponse } from "next/server";

import { saveHomeworkAnalyticsEvent } from "@/lib/homework-analytics";
import {
  generatePersonalizedQuizFromMistakes,
  getStudentPersonalizationBundle,
} from "@/lib/personalization";
import { requireAuthenticatedUser } from "@/lib/request-auth";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId } = await params;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId")?.trim() ?? "";
    const questionId = searchParams.get("questionId")?.trim() ?? "";

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedUser(request, studentId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const bundle = await getStudentPersonalizationBundle({
      studentId: authResult.userId,
      homeworkSetId: setId,
      questionId: questionId || null,
    });

    return NextResponse.json(bundle);
  } catch (error: any) {
    console.error("Failed to load homework personalization bundle:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load personalization" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId } = await params;
    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const questionId = typeof body.questionId === "string" ? body.questionId.trim() : "";
    const recommendationId =
      typeof body.recommendationId === "string" ? body.recommendationId.trim() : "";
    const maxQuestions =
      typeof body.maxQuestions === "number" ? body.maxQuestions : Number(body.maxQuestions || 4);

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedUser(request, studentId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const quiz = await generatePersonalizedQuizFromMistakes({
      studentId: authResult.userId,
      homeworkSetId: setId,
      questionId: questionId || null,
      maxQuestions,
    });

    await saveHomeworkAnalyticsEvent({
      actorId: authResult.userId,
      type: "runner.personalized_quiz_started",
      setId,
      questionId: questionId || undefined,
      metadata: {
        quizId: quiz.quizId,
        recommendationId: recommendationId || null,
        themes: quiz.personalization?.themes ?? [],
        targetType: quiz.targetType,
      },
    });

    return NextResponse.json({ quiz });
  } catch (error: any) {
    console.error("Failed to generate personalized homework quiz:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate personalized quiz" },
      { status: 500 }
    );
  }
}
