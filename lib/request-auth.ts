import { NextRequest } from 'next/server';

import { resolveLearnerIdentity } from '@/lib/learner-identity';
import { resolveAuthenticatedSession } from '@/lib/session-auth';
import type { UserModel } from '@/lib/users';

type AuthResult =
  | { ok: true; user: UserModel; userId: string }
  | { ok: false; status: number; error: string };

export async function requireAuthenticatedUser(
  request: NextRequest,
  expectedUserId?: string
): Promise<AuthResult> {
  const headerUserId = request.headers.get('x-user-id')?.trim() ?? '';
  const authenticatedSession = await resolveAuthenticatedSession(
    request,
    'request-auth.requireAuthenticatedUser'
  );

  if (!authenticatedSession) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  if (headerUserId) {
    const headerIdentity = await resolveLearnerIdentity(
      headerUserId,
      'request-auth.headerUserId'
    );

    if (!headerIdentity.user) {
      return { ok: false, status: 403, error: 'Unauthorized' };
    }

    if (headerIdentity.canonicalId !== authenticatedSession.userId) {
      return { ok: false, status: 403, error: 'Unauthorized' };
    }
  }

  if (expectedUserId) {
    const expectedIdentity = await resolveLearnerIdentity(
      expectedUserId,
      'request-auth.expectedUserId'
    );

    if (expectedIdentity.canonicalId !== authenticatedSession.userId) {
      return { ok: false, status: 403, error: 'Unauthorized' };
    }
  }

  return {
    ok: true,
    user: authenticatedSession.user as UserModel,
    userId: authenticatedSession.userId,
  };
}
