import { NextRequest, NextResponse } from "next/server";

import { requireAuthenticatedUser } from "@/lib/request-auth";
import {
  listStudentPreferences,
  normalizeStudentPreferenceKey,
  upsertStudentPreference,
  type StudentPreferenceScope,
  type StudentPreferenceSource,
} from "@/lib/student-preferences";

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedUser(request, studentId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const preferences = await listStudentPreferences(authResult.userId);
    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error("Failed to load student preferences:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load preferences" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { studentId } = await params;
    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedUser(request, studentId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const items = Array.isArray(body.preferences)
      ? body.preferences
      : [
          {
            key: body.key,
            value: body.value,
            notes: body.notes,
            scope: body.scope,
            confidence: body.confidence,
          },
        ];

    if (!items.length) {
      return NextResponse.json({ error: "At least one preference is required" }, { status: 400 });
    }

    const saved = [];
    for (const item of items) {
      const key = normalizeStudentPreferenceKey(
        typeof item?.key === "string" ? item.key : null
      );
      const value = typeof item?.value === "string" ? item.value.trim() : "";

      if (!key || !value) {
        return NextResponse.json(
          { error: "Each preference requires a supported key and a non-empty value" },
          { status: 400 }
        );
      }

      saved.push(
        await upsertStudentPreference({
          userId: authResult.userId,
          key,
          value,
          notes: typeof item.notes === "string" ? item.notes.trim() : undefined,
          scope:
            item.scope === "session" || item.scope === "stable"
              ? (item.scope as StudentPreferenceScope)
              : undefined,
          confidence:
            typeof item.confidence === "number" ? item.confidence : 1,
          source: "student" as StudentPreferenceSource,
        })
      );
    }

    return NextResponse.json({ preferences: saved });
  } catch (error: any) {
    console.error("Failed to save student preferences:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save preferences" },
      { status: 500 }
    );
  }
}
