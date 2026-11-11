import { data } from 'react-router';

import type { Route } from './+types/api-account-2fa-enroll';
import { beginEnrollment } from '~/features/two-factor/.server/use-cases/enroll';
import {
  readStepUpAction,
  stepUpErrorResponse,
  stepUpSuccessResponse,
} from '~/features/two-factor/.server/step-up-route';

export async function action({ request, context }: Route.ActionArgs) {
  const guard = await readStepUpAction(request, context);
  if (!guard.ok) return guard.response;

  const result = await beginEnrollment(guard.env, request, guard.user.id, guard.user.email, guard.input);
  if (result.status === 'already-enabled') {
    return data({ ok: false, error: 'already-enabled' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  if (result.status !== 'ok') return stepUpErrorResponse(result)!;
  return stepUpSuccessResponse({ secret: result.secret, uri: result.uri }, null);
}
