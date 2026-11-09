import { redirect } from 'react-router';

import { createUsersQueries } from './queries/users';

export const requireConfigured = async (env: Env): Promise<void> => {
  if ((await createUsersQueries(env).count()) === 0) {
    throw redirect('/setup');
  }
};

export const requireBootstrapAvailable = async (env: Env): Promise<void> => {
  if ((await createUsersQueries(env).count()) !== 0) {
    throw redirect('/login');
  }
};
