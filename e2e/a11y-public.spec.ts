import { expect, test } from '@playwright/test';

import { expectNoSeriousA11yViolations } from './a11y';
import { waitForHydration } from './fixtures';

test('setup wizard has no critical or serious accessibility violations', async ({ page }) => {
  await page.goto('/setup');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expectNoSeriousA11yViolations(page, 'setup');
});
