import { data, type RouterContextProvider } from 'react-router';

import { readGuardedMutation, type GuardedMutation } from '../../../lib/.server/mutation-guard';
import { requireUserApi } from '../../../lib/.server/require-user';
import { parseStepUpInput } from './two-factor-input';

export const readTwoFactorAction = <T>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  parseInput: (value: unknown) => T | null,
): Promise<GuardedMutation<T>> =>
  readGuardedMutation(request, context, {
    scope: '2fa-step-up',
    authorize: requireUserApi,
    parseInput,
  });

export const readStepUpAction = (request: Request, context: Readonly<RouterContextProvider>) =>
  readTwoFactorAction(request, context, parseStepUpInput);

export const stepUpErrorResponse = (result: {
  status: string;
  retryAfter?: number;
}): ReturnType<typeof data> | null => {
  if (result.status === 'invalid-password') return data({ ok: false, error: 'invalid-password' }, { status: 400 });
  if (result.status === 'locked') {
    return data(
      { ok: false, error: 'locked' },
      { status: 423, headers: { 'Retry-After': String(result.retryAfter ?? 60), 'Cache-Control': 'no-store' } },
    );
  }
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });
  return null;
};

export const stepUpSuccessResponse = (payload: Record<string, unknown>, cookie: string | null) =>
  data(
    { ok: true, ...payload, sessionIssued: cookie !== null },
    { headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } },
  );
