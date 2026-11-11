import { data } from 'react-router';

import type { Route } from './+types/api-account-2fa-verify';
import { parseCodeInput } from '~/features/two-factor/.server/two-factor-input';
import { readTwoFactorAction } from '~/features/two-factor/.server/step-up-route';
import { verifyEnrollment } from '~/features/two-factor/.server/use-cases/verify-enrollment';

export async function action({ request, context }: Route.ActionArgs) {
  const guard = await readTwoFactorAction(request, context, parseCodeInput);
  if (!guard.ok) return guard.response;

  const result = await verifyEnrollment(guard.env, request, guard.user.id, guard.input.code);

  if (result.status === 'invalid-code') return data({ ok: false, error: 'invalid-code' }, { status: 401 });
  if (result.status === 'not-pending') return data({ ok: false, error: 'not-pending' }, { status: 409 });
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });

  return data(
    { ok: true, backupCodes: result.backupCodes, sessionIssued: result.cookie !== null },
    { headers: { 'Cache-Control': 'no-store', ...(result.cookie ? { 'Set-Cookie': result.cookie } : {}) } },
  );
}
