import { redirect } from 'react-router';

import { isBootstrapAvailable } from './bootstrap';
import { getDatabase } from './db';

export const requireConfigured = async (env: Env): Promise<void> => {
  if (await isBootstrapAvailable(getDatabase(env))) {
    throw redirect('/setup');
  }
};

export const requireBootstrapAvailable = async (env: Env): Promise<void> => {
  if (!(await isBootstrapAvailable(getDatabase(env)))) {
    throw redirect('/login');
  }
};
