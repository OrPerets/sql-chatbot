import { NextRequest, NextResponse } from "next/server";

import { getUserBalance } from "@/lib/coins";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { getUsersService } from "@/lib/users";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId =
      typeof body?.userId === "string" && body.userId.trim().length > 0 ? body.userId.trim() : null;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const usersService = await getUsersService();
    const resolvedUser =
      authResult.user.email?.trim().toLowerCase()
        ? authResult.user
        : await usersService.findUserByIdOrEmail(userId);
    const email = resolvedUser?.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "משתמש לא נמצא במערכת" }, { status: 404 });
    }

    const balance = await getUserBalance(email);

    return NextResponse.json({
      currentBalance: balance.coins,
      cost: 0,
      billingDisabled: true,
    });
  } catch (error) {
    console.error("Error opening SQL practice:", error);
    return NextResponse.json({ error: "Failed to open SQL practice" }, { status: 500 });
  }
}
