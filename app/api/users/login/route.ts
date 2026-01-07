import { NextRequest, NextResponse } from 'next/server';
import { getUsersService } from '@/lib/users';

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

    return NextResponse.json({
      success: true,
      id: userId,
      email: user.email,
      name: userName,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בהתחברות' },
      { status: 500 }
    );
  }
}
