import { NextRequest, NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { parseAcademicPeriodFromSearchParams } from "@/lib/academic-period";
import { getAdminStudentEvidenceBundle } from "@/lib/admin-student-insights";
import { isStudentProfileInAcademicPeriod } from "@/lib/admin-student-profile-summary";
import { connectToDatabase } from "@/lib/database";
import { applyAdminOversightAction, updateKnowledgeScore } from "@/lib/student-profiles";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    await requireAdmin(_request);

    const params = await context.params;
    const { studentId } = params;

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(_request.url);
    const academicPeriod = parseAcademicPeriodFromSearchParams(searchParams);
    const evidenceBundle = await getAdminStudentEvidenceBundle(studentId, { academicPeriod });

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
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

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
    const { email: adminEmail } = await requireAdmin(request);
    const params = await context.params;
    const { studentId } = params;
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const academicPeriod = parseAcademicPeriodFromSearchParams(searchParams);

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    if (academicPeriod) {
      const { db } = await connectToDatabase();
      const isInCohort = await isStudentProfileInAcademicPeriod(db, studentId, academicPeriod);
      if (!isInCohort) {
        return NextResponse.json(
          { success: false, error: "Student is not in the selected academic period" },
          { status: 404 }
        );
      }
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
        createdBy: adminEmail,
      });

      if (!updatedProfile) {
        return NextResponse.json(
          { success: false, error: "Failed to apply admin action" },
          { status: 500 }
        );
      }

      const evidenceBundle = await getAdminStudentEvidenceBundle(studentId, { academicPeriod });
      return NextResponse.json({
        success: true,
        data: evidenceBundle,
      });
    }

    const { knowledgeScore, reason } = body;

    if (!knowledgeScore || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: "knowledgeScore and reason are required",
        },
        { status: 400 }
      );
    }

    const success = await updateKnowledgeScore(studentId, knowledgeScore, reason, "admin");

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to update knowledge score" },
        { status: 500 }
      );
    }

    const evidenceBundle = await getAdminStudentEvidenceBundle(studentId, { academicPeriod });
    return NextResponse.json({
      success: true,
      data: evidenceBundle,
      message: "Knowledge score updated successfully",
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

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
