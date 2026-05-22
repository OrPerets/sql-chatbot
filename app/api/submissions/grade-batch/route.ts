import { NextResponse } from "next/server";
import { gradeSubmissions } from "@/lib/submissions";
import type { Submission } from "@/app/homework/types";

interface GradeSubmissionBatchEntry {
  submissionId: string;
  updates: Partial<Submission>;
}

function isGradeBatchEntry(value: unknown): value is GradeSubmissionBatchEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GradeSubmissionBatchEntry>;
  return typeof candidate.submissionId === "string"
    && candidate.submissionId.trim().length > 0
    && Boolean(candidate.updates)
    && typeof candidate.updates === "object";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const updates = Array.isArray(body.updates)
      ? body.updates.filter(isGradeBatchEntry)
      : [];

    if (updates.length === 0) {
      return NextResponse.json({ error: "updates must contain at least one grade update" }, { status: 400 });
    }

    const submissions = await gradeSubmissions(updates);
    return NextResponse.json(submissions);
  } catch (error) {
    console.error("[API Grade Batch] Error grading submissions:", error);
    return NextResponse.json(
      {
        error: "Failed to grade submissions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
