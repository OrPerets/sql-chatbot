import { NextRequest } from "next/server";

import { requireInstructorOrAdmin } from "@/lib/admin-auth";
import { COLLECTIONS, executeWithRetry } from "@/lib/database";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await requireInstructorOrAdmin(request);

  const limitParam = Number(request.nextUrl.searchParams.get("limit") || 50);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

  const rows = await executeWithRetry(async (db) => {
    return db
      .collection(COLLECTIONS.AUDIT_LOGS)
      .find({
        kind: "openai_tool_usage",
        toolName: "grade_with_rubric",
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  });

  return Response.json({
    success: true,
    count: rows.length,
    audits: rows,
  });
}
