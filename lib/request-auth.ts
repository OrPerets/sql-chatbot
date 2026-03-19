import { NextRequest } from 'next/server';

import { getUsersService, UserModel } from '@/lib/users';

type AuthResult =
  | { ok: true; user: UserModel; userId: string }
  | { ok: false; status: number; error: string };

const resolveUserFromIdentifier = async (identifier: string | null) => {
  if (!identifier) {
    return null;
  }

  const usersService = await getUsersService();
  return usersService.findUserByIdOrEmail(identifier);
};

const matchesUser = (user: UserModel, identifier: string) => {
  const resolvedId = user.id ?? user._id?.toString();
  return [resolvedId, user.email].filter(Boolean).includes(identifier);
};

export async function requireAuthenticatedUser(
  request: NextRequest,
  expectedUserId?: string
): Promise<AuthResult> {
  const headerUserId = request.headers.get('x-user-id')?.trim() ?? '';
  const cookieUserId = request.cookies.get('michael-user')?.value?.trim() ?? '';

  if (!headerUserId && !cookieUserId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const [headerUser, cookieUser] = await Promise.all([
    resolveUserFromIdentifier(headerUserId || null),
    resolveUserFromIdentifier(cookieUserId || null),
  ]);

  if (headerUserId && !headerUser) {
    return { ok: false, status: 403, error: 'Unauthorized' };
  }

  if (cookieUserId && !cookieUser) {
    return { ok: false, status: 403, error: 'Unauthorized' };
  }

  if (headerUser && cookieUser && headerUser.email !== cookieUser.email) {
    return { ok: false, status: 403, error: 'Unauthorized' };
  }

  const authenticatedUser = headerUser ?? cookieUser;

  if (!authenticatedUser) {
    return { ok: false, status: 403, error: 'Unauthorized' };
  }

  if (expectedUserId && !matchesUser(authenticatedUser, expectedUserId)) {
    return { ok: false, status: 403, error: 'Unauthorized' };
  }

  const resolvedUserId =
    authenticatedUser.id ??
    authenticatedUser._id?.toString() ??
    authenticatedUser.email ??
    headerUserId ??
    cookieUserId;

  return { ok: true, user: authenticatedUser, userId: resolvedUserId };
}
