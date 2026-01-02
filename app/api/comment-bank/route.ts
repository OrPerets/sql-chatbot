import { NextResponse } from "next/server";
import {
  getCommentsForQuestion,
  getCommentsForHomeworkSet,
  createComment,
  updateComment,
  deleteComment,
  incrementUsageCount,
  searchComments,
} from "@/lib/comment-bank";

/**
 * GET /api/comment-bank
 * Query params:
 * - homeworkSetId (required): Homework set ID
 * - questionId (optional): Question ID to filter by
 * - search (optional): Search text to filter comments
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const homeworkSetId = searchParams.get("homeworkSetId");
    const questionId = searchParams.get("questionId");
    const search = searchParams.get("search");

    if (!homeworkSetId) {
      return NextResponse.json(
        { error: "homeworkSetId is required" },
        { status: 400 }
      );
    }

    let comments;

    if (search) {
      comments = await searchComments(homeworkSetId, search);
    } else if (questionId) {
      comments = await getCommentsForQuestion(homeworkSetId, questionId);
    } else {
      comments = await getCommentsForHomeworkSet(homeworkSetId);
    }

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comment bank:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comment-bank
 * Create a new comment or increment usage count
 * Body:
 * - action: "create" | "use"
 * - For "create": homeworkSetId, questionId, comment, score, maxScore, category?, createdBy
 * - For "use": commentId
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "use") {
      const { commentId } = body;
      if (!commentId) {
        return NextResponse.json(
          { error: "commentId is required for 'use' action" },
          { status: 400 }
        );
      }
      await incrementUsageCount(commentId);
      return NextResponse.json({ success: true });
    }

    // Default action is "create"
    const { homeworkSetId, questionId, comment, score, maxScore, category, createdBy } = body;

    if (!homeworkSetId || !questionId || !comment || score === undefined || maxScore === undefined || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields: homeworkSetId, questionId, comment, score, maxScore, createdBy" },
        { status: 400 }
      );
    }

    const newComment = await createComment({
      homeworkSetId,
      questionId,
      comment,
      score,
      maxScore,
      category,
      createdBy,
    });

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/comment-bank
 * Update an existing comment
 * Body:
 * - commentId (required): Comment ID to update
 * - comment (optional): New comment text
 * - score (optional): New score
 * - category (optional): New category
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { commentId, ...updates } = body;

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 }
      );
    }

    const updatedComment = await updateComment(commentId, updates);

    if (!updatedComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/comment-bank
 * Delete a comment
 * Query params:
 * - commentId (required): Comment ID to delete
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteComment(commentId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Comment not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
