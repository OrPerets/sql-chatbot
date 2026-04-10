import { NextRequest, NextResponse } from "next/server";
import { getUsersService } from "@/lib/users";

function placeholderNamesFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0] ?? "student";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "Student", lastName: "User" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "User" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "נא להזין כתובת אימייל" }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "נא להזין סיסמה" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const usersService = await getUsersService();

    let user = await usersService.getUserByEmail(normalizedEmail);

    if (!user) {
      const { firstName, lastName } = placeholderNamesFromEmail(normalizedEmail);
      const created = await usersService.createUser({
        email: normalizedEmail,
        firstName,
        lastName,
        password: password.trim(),
        isFirst: true,
      });

      if (!created.success && created.error?.includes("already exists")) {
        user = await usersService.getUserByEmail(normalizedEmail);
        if (user && user.password !== password.trim()) {
          return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
        }
      } else if (!created.success) {
        return NextResponse.json(
          { error: created.error || "לא ניתן ליצור משתמש זמנית" },
          { status: 500 }
        );
      }

      if (!user) {
        user = await usersService.getUserByEmail(normalizedEmail);
      }

      if (!user) {
        return NextResponse.json({ error: "לא ניתן לטעון את חשבון הסטודנט" }, { status: 500 });
      }
    } else if (user.password !== password.trim()) {
      return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
    }

    const userId = user.id || user._id?.toString() || normalizedEmail;
    const userName =
      user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;

    return NextResponse.json({
      success: true,
      id: userId,
      email: user.email,
      name: userName,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error: unknown) {
    console.error("Error during homework student login:", error);
    const message = error instanceof Error ? error.message : "שגיאה בהתחברות";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
