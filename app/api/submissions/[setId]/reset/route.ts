import { NextResponse } from "next/server";
import { connectToDatabase, COLLECTIONS } from "@/lib/database";
import { ObjectId } from "mongodb";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { studentId } = (await request.json()) as { studentId?: string };
    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // Reset submission status to in_progress
    const result = await db
      .collection(COLLECTIONS.SUBMISSIONS)
      .findOneAndUpdate(
        { 
          homeworkSetId: params.setId,
          studentId: studentId
        },
        { 
          $set: {
            status: "in_progress",
            updatedAt: now,
          },
          $unset: { 
            submittedAt: "" 
          }
        },
        { returnDocument: 'after' }
      );

    if (!result) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: result._id?.toString() || result.id,
        status: result.status,
        homeworkSetId: result.homeworkSetId,
        studentId: result.studentId,
      }
    });
  } catch (error) {
    console.error('Error resetting submission:', error);
    return NextResponse.json(
      { error: 'Failed to reset submission' },
      { status: 500 }
    );
  }
}

