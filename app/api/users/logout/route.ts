import { NextResponse } from 'next/server';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '@/lib/session-auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set('michael-user', '', {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set('michael-role', '', {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
