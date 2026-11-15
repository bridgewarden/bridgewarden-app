import { expect, type Page } from '@playwright/test';

export const assertNoOverflow = async (page: Page) => {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
};
