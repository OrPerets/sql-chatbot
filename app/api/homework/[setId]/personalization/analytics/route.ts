import { NextRequest, NextResponse } from "next/server";

import { saveHomeworkAnalyticsEvent } from "@/lib/homework-analytics";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import type { AnalyticsEvent } from "@/app/homework/types";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

type AllowedEventType = Extract<
  AnalyticsEvent["type"],
  "runner.personalization_shown" | "runner.personalization_accepted"
>;

const ALLOWED_EVENT_TYPES = new Set<AllowedEventType>([
  "runner.personalization_shown",
  "runner.personalization_accepted",
]);

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId } = await params;
    const body = await request.json();
    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const eventType = typeof body.eventType === "string" ? body.eventType : "";
    const questionId = typeof body.questionId === "string" ? body.questionId.trim() : "";

    if (!studentId || !ALLOWED_EVENT_TYPES.has(eventType as AllowedEventType)) {
      return NextResponse.json(
        { error: "studentId and a valid eventType are required" },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request, studentId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const savedEvent = await saveHomeworkAnalyticsEvent({
      actorId: authResult.userId,
      type: eventType as AllowedEventType,
      setId,
      questionId: questionId || undefined,
      metadata:
        body.metadata && typeof body.metadata === "object"
          ? body.metadata
          : {},
    });

    return NextResponse.json({ event: savedEvent });
  } catch (error: any) {
    console.error("Failed to persist homework personalization analytics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save personalization analytics" },
      { status: 500 }
    );
  }
}
