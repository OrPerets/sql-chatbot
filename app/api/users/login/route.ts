import { NextRequest, NextResponse } from 'next/server';
import { getUsersService } from '@/lib/users';
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/lib/session-auth';

const ADMIN_EMAILS = new Set([
  'liorbs89@gmail.com',
  'eyalh747@gmail.com',
  'orperets11@gmail.com',
  'roeizer@shenkar.ac.il',
  'r_admin@gmail.com',
]);

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'נא להזין כתובת אימייל' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'נא להזין סיסמה' },
        { status: 400 }
      );
    }

    const usersService = await getUsersService();
    const user = await usersService.getUserByEmail(email.toLowerCase().trim());

    if (!user) {
      return NextResponse.json(
        { error: 'משתמש לא נמצא במערכת' },
        { status: 404 }
      );
    }

    // Check password
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'סיסמה שגויה' },
        { status: 401 }
      );
    }

    // Return user info (excluding sensitive data like password)
    // Use the user's id field if available, otherwise use _id
    const userId = user.id || user._id?.toString() || email;
    const userName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || email;
    const normalizedEmail = user.email.toLowerCase().trim();
    const resolvedRole = typeof user.role === 'string' && user.role.trim()
      ? user.role.trim().toLowerCase()
      : ADMIN_EMAILS.has(normalizedEmail)
        ? 'admin'
        : 'student';
    const sessionToken = await createSessionToken({
      userId,
      email: normalizedEmail,
      role: resolvedRole,
    });

    const response = NextResponse.json({
      success: true,
      id: userId,
      email: user.email,
      name: userName,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());
    response.cookies.set('michael-user', '', {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });
    response.cookies.set('michael-role', '', {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בהתחברות' },
      { status: 500 }
    );
  }
}
