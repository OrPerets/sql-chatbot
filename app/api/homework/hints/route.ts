import { NextRequest, NextResponse } from "next/server";

import { chargeHomeworkHintOpen, getCoinsConfig, getUserBalance } from "@/lib/coins";
import { requireAuthenticatedUser } from "@/lib/request-auth";
import { getUsersService } from "@/lib/users";

const PLACEHOLDER_HINT =
  "רמז לדוגמה: נסו להתחיל מזיהוי הטבלאות הרלוונטיות ולבדוק אילו עמודות דרושות לפתרון.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const studentId =
      typeof body?.studentId === "string" && body.studentId.trim().length > 0
        ? body.studentId.trim()
        : null;
    const setId =
      typeof body?.setId === "string" && body.setId.trim().length > 0 ? body.setId.trim() : undefined;
    const questionId =
      typeof body?.questionId === "string" && body.questionId.trim().length > 0
        ? body.questionId.trim()
        : undefined;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedUser(request, studentId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const config = await getCoinsConfig();
    if (!config.modules.homeworkHints) {
      return NextResponse.json({ error: "פתיחת רמזים אינה זמינה כרגע." }, { status: 403 });
    }

    const usersService = await getUsersService();
    const resolvedUser =
      authResult.user.email?.trim().toLowerCase()
        ? authResult.user
        : await usersService.findUserByIdOrEmail(studentId);
    const email = resolvedUser?.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "משתמש לא נמצא במערכת" }, { status: 404 });
    }

    const billingResult = await chargeHomeworkHintOpen(email, {
      setId,
      questionId,
      studentId,
    });

    if (billingResult.ok === false) {
      return NextResponse.json(
        {
          error: "אין מספיק מטבעות",
          balance: billingResult.balance,
          required: billingResult.required,
        },
        { status: 402 }
      );
    }

    const balance = await getUserBalance(email);

    return NextResponse.json({
      hint: PLACEHOLDER_HINT,
      currentBalance: balance.coins,
    });
  } catch (error) {
    console.error("Error opening homework hint:", error);
    return NextResponse.json({ error: "Failed to open homework hint" }, { status: 500 });
  }
}
