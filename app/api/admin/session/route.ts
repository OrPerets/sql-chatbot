import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    return NextResponse.json({ email: admin.email });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Error resolving admin session:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
