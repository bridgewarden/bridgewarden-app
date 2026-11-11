import type { Route } from './+types/api-account-2fa-disable';
import { disableTwoFactor } from '~/features/two-factor/.server/use-cases/disable';
import {
  readStepUpAction,
  stepUpErrorResponse,
  stepUpSuccessResponse,
} from '~/features/two-factor/.server/step-up-route';

export async function action({ request, context }: Route.ActionArgs) {
  const guard = await readStepUpAction(request, context);
  if (!guard.ok) return guard.response;

  const result = await disableTwoFactor(guard.env, request, guard.user.id, guard.input);
  if (result.status !== 'ok') return stepUpErrorResponse(result)!;
  return stepUpSuccessResponse({}, result.cookie);
}
