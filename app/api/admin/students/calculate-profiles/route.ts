import { NextRequest, NextResponse } from "next/server";

import { COLLECTIONS, connectToDatabase } from "@/lib/database";
import { recalculateStudentProfile } from "@/lib/student-profile-recalculation";

export async function POST(_request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    console.log("Starting profile recalculation with canonical learner identity normalization");

    const users = await db.collection(COLLECTIONS.USERS).find({}).toArray();
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
      },
      message: "Profile recalculation completed successfully",
    });
  } catch (error) {
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
