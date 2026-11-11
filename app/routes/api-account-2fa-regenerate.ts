import type { Route } from './+types/api-account-2fa-regenerate';
import { regenerateBackupCodes } from '~/features/two-factor/.server/use-cases/regenerate';
import {
  readStepUpAction,
  stepUpErrorResponse,
  stepUpSuccessResponse,
} from '~/features/two-factor/.server/step-up-route';

export async function action({ request, context }: Route.ActionArgs) {
  const guard = await readStepUpAction(request, context);
  if (!guard.ok) return guard.response;

  const result = await regenerateBackupCodes(guard.env, request, guard.user.id, guard.input);
  if (result.status !== 'ok') return stepUpErrorResponse(result)!;
  return stepUpSuccessResponse({ backupCodes: result.backupCodes }, result.cookie);
}
