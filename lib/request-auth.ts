import { NextRequest } from 'next/server';

import { resolveLearnerIdentity } from '@/lib/learner-identity';
import type { UserModel } from '@/lib/users';

type AuthResult =
  | { ok: true; user: UserModel; userId: string }
  | { ok: false; status: number; error: string };

const resolveUserFromIdentifier = async (identifier: string | null) => {
  if (!identifier) {
    return null;
  }

  const identity = await resolveLearnerIdentity(identifier, 'request-auth.resolveUserFromIdentifier');
  if (!identity.user) {
    return null;
  }

  return {
    identity,
    user: identity.user,
  };
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

  if (
    headerUser &&
    cookieUser &&
    headerUser.identity.canonicalId !== cookieUser.identity.canonicalId
  ) {
    return { ok: false, status: 403, error: 'Unauthorized' };
  }

  const authenticatedUser = headerUser ?? cookieUser;

  if (!authenticatedUser) {
    return { ok: false, status: 403, error: 'Unauthorized' };
  }

  if (expectedUserId) {
    const expectedIdentity = await resolveLearnerIdentity(
      expectedUserId,
      'request-auth.expectedUserId'
    );

    if (expectedIdentity.canonicalId !== authenticatedUser.identity.canonicalId) {
      return { ok: false, status: 403, error: 'Unauthorized' };
    }
  }

  return {
    ok: true,
    user: authenticatedUser.user as UserModel,
    userId: authenticatedUser.identity.canonicalId,
  };
}
