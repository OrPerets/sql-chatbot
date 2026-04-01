import { NextRequest, NextResponse } from "next/server";

import { getAdminStudentEvidenceBundle } from "@/lib/admin-student-insights";
import { applyAdminOversightAction, updateKnowledgeScore } from "@/lib/student-profiles";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const params = await context.params;
    const { studentId } = params;

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    const evidenceBundle = await getAdminStudentEvidenceBundle(studentId);

    if (!evidenceBundle) {
      return NextResponse.json(
        { success: false, error: "Student profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: evidenceBundle,
    });
  } catch (error) {
    console.error("Error fetching student evidence bundle:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch student evidence bundle",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const params = await context.params;
    const { studentId } = params;
    const body = await request.json();

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    if (body.actionType) {
      const updatedProfile = await applyAdminOversightAction(studentId, {
        actionType: body.actionType,
        topic: typeof body.topic === "string" ? body.topic : null,
        note: typeof body.note === "string" ? body.note : null,
        goal: typeof body.goal === "string" ? body.goal : null,
        intervention: typeof body.intervention === "string" ? body.intervention : null,
        expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
        recommendationId:
          typeof body.recommendationId === "string" ? body.recommendationId : null,
        createdBy:
          request.headers.get("x-user-email")?.trim() ||
          request.headers.get("x-admin-email")?.trim() ||
          "admin",
      });

      if (!updatedProfile) {
        return NextResponse.json(
          { success: false, error: "Failed to apply admin action" },
          { status: 500 }
        );
      }

      const evidenceBundle = await getAdminStudentEvidenceBundle(studentId);
      return NextResponse.json({
        success: true,
        data: evidenceBundle,
      });
    }

    const { knowledgeScore, reason, updatedBy } = body;

    if (!knowledgeScore || !reason || !updatedBy) {
      return NextResponse.json(
        {
          success: false,
          error: "knowledgeScore, reason, and updatedBy are required",
        },
        { status: 400 }
      );
    }

    const success = await updateKnowledgeScore(studentId, knowledgeScore, reason, updatedBy);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to update knowledge score" },
        { status: 500 }
      );
    }

    const evidenceBundle = await getAdminStudentEvidenceBundle(studentId);
    return NextResponse.json({
      success: true,
      data: evidenceBundle,
      message: "Knowledge score updated successfully",
    });
  } catch (error) {
    console.error("Error updating student profile:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update student profile",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
