import type { RouterContextProvider } from 'react-router';

import { readGuardedMutation, type GuardedMutation } from '../../../lib/.server/mutation-guard';
import { requireAdminApi } from '../../../lib/.server/require-user';

export function readAdminMutation<T>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  parseInput: (value: unknown) => T | null,
): Promise<GuardedMutation<T>>;
export function readAdminMutation(
  request: Request,
  context: Readonly<RouterContextProvider>,
): Promise<GuardedMutation<undefined>>;
export function readAdminMutation<T>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  parseInput?: (value: unknown) => T | null,
): Promise<GuardedMutation<T>> {
  return readGuardedMutation(request, context, {
    scope: 'admin',
    authorize: requireAdminApi,
    parseInput,
  });
}
