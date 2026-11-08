import type { Page } from '@playwright/test';

export const E2E_ADMIN = {
  email: 'admin@example.com',
  displayName: 'Administrator',
  password: 'correct horse battery staple',
};

export const waitForHydration = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __reactRouterContext?: unknown }).__reactRouterContext),
  );
};
