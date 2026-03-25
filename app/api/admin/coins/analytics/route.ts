import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { getCoinsAdminOverview } from "@/lib/coins";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const overview = await getCoinsAdminOverview();
    return NextResponse.json(overview);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Error getting admin coins analytics:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
