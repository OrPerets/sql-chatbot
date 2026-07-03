import { NextRequest, NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { buildAcademicPeriodUserQuery, parseAcademicPeriodFromSearchParams } from "@/lib/academic-period";
import { isStudentUserRecord } from "@/lib/admin-student-profile-summary";
import { COLLECTIONS, connectToDatabase } from "@/lib/database";
import { recalculateStudentProfile } from "@/lib/student-profile-recalculation";
import type { UserModel } from "@/lib/users";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const academicPeriod = parseAcademicPeriodFromSearchParams(searchParams);
    console.log("Starting profile recalculation with canonical learner identity normalization", {
      academicPeriod,
    });

    const users = (await db
      .collection<UserModel>(COLLECTIONS.USERS)
      .find(buildAcademicPeriodUserQuery(academicPeriod) as never)
      .toArray()).filter(isStudentUserRecord);
    console.log(`Found ${users.length} users for profile recalculation`);

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        const identifier = user.id || user._id?.toString() || user.email;
        if (!identifier) {
          continue;
        }

        const result = await recalculateStudentProfile(db, identifier);
        if (result.created) {
          created += 1;
        } else {
          updated += 1;
        }
      } catch (error) {
        const message = `Failed to recalculate profile for ${user.email}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        errors.push(message);
        console.error(message);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        created,
        updated,
        errors: errors.length,
        errorDetails: errors.slice(0, 5),
        totalCandidates: users.length,
        academicPeriod,
      },
      message: "Profile recalculation completed successfully",
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    console.error("Error recalculating student profiles:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate profiles",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
