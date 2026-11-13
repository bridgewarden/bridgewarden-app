import { expect, test, type Page } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { expectNoSeriousA11yViolations } from './a11y';
import { signIn, waitForHydration } from './fixtures';

const openSearch = async (page: Page) => {
  await page.getByRole('button', { name: new RegExp(en['search.trigger']) }).click();
  const dialog = page.getByRole('dialog', { name: en['search.title'] });
  await expect(dialog).toBeVisible();
  const input = dialog.getByRole('combobox', { name: en['search.label'] });
  await expect(input).toBeFocused();
  return { dialog, input };
};

const createLogin = async (page: Page, name: string, username: string, url: string, notes?: string) => {
  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await page.getByLabel(en['vaultItem.name']).fill(name);
  await page.getByLabel(en['vaultItem.username']).fill(username);
  await page.getByLabel(/^Password/).fill('search password');
  await page.getByLabel('URL 1', { exact: true }).fill(url);
  if (notes) await page.getByLabel(en['vaultItem.notes']).fill(notes);
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
};

test('searches decrypted fields locally and supports keyboard, offline, and privacy', async ({ context, page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  const stamp = Date.now();
  const name = `Search ${stamp}`;
  const username = `search-user-${stamp}@example.com`;
  const url = `https://search-${stamp}.example.com`;
  const notes = `private-note-${stamp}`;
  const body = `secure-body-${stamp}`;

  await createLogin(page, name, username, url, notes);
  await createLogin(page, `${name} Two`, `search-two-${stamp}@example.com`, `https://two-${stamp}.example.com`);
  await createLogin(page, `${name} Three`, `search-three-${stamp}@example.com`, `https://three-${stamp}.example.com`);

  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await page.getByLabel(en['vaultItem.name']).fill(`Search note ${stamp}`);
  await page.getByRole('combobox', { name: en['vault.type'] }).click();
  await page.getByRole('option', { name: en['vault.type.note'] }).click();
  await page.getByLabel(en['vaultItem.body']).fill(body);
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
  await waitForHydration(page);
  await page.waitForLoadState('networkidle');

  const requests: { url: string; body: string }[] = [];
  page.on('request', (request) => {
    requests.push({ url: request.url(), body: request.postData() ?? '' });
  });

  await openSearch(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: en['search.title'] })).toBeHidden();

  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('dialog', { name: en['search.title'] })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: en['search.title'] })).toBeHidden();

  const { dialog, input } = await openSearch(page);
  await input.fill(stamp.toString());
  const targetOption = dialog.getByRole('option').filter({ hasText: name }).filter({ hasText: username });
  await expect(targetOption).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'search palette with results');

  await input.fill('search-user-');
  await expect(dialog.getByRole('option', { name: new RegExp(name) })).toBeVisible();
  await expect(dialog.locator('mark').first()).toContainText('search-user-');

  await input.fill(`search-${stamp}.example.com`);
  await expect(dialog.getByRole('option', { name: new RegExp(name) })).toBeVisible();
  await expect(dialog.locator('mark').first()).toContainText(`search-${stamp}.example.com`);

  await input.fill(notes);
  await expect(dialog.getByRole('option', { name: new RegExp(name) })).toBeVisible();
  await expect(dialog.locator('mark').first()).toContainText(notes);

  await input.fill(body);
  await expect(dialog.getByRole('option', { name: new RegExp(`Search note ${stamp}`) })).toBeVisible();
  await expect(dialog.locator('mark').first()).toContainText(body);

  const searchTokens = [stamp.toString(), 'search-user-', notes, `search-${stamp}.example.com`, body];
  const leaked = requests.some((request) =>
    searchTokens.some((token) => request.url.includes(token) || request.body.includes(token)),
  );
  expect(leaked).toBe(false);

  const privacy = await page.evaluate(() => ({
    href: location.href,
    hash: location.hash,
    state: JSON.stringify(history.state),
    local: JSON.stringify(localStorage),
    session: JSON.stringify(sessionStorage),
  }));
  const leakedPrivacy = searchTokens.filter((token) => JSON.stringify(privacy).includes(token));
  expect(leakedPrivacy.length).toBe(0);

  await input.fill(stamp.toString());
  const options = dialog.getByRole('option');
  await expect(options).toHaveCount(4);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const activeId = await input.getAttribute('aria-activedescendant');
  const firstId = await options.nth(0).getAttribute('id');
  expect(activeId).not.toBeNull();
  expect(activeId).not.toBe(firstId);
  await expect(page.locator(`#${activeId}`)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  const detailDialog = page.getByRole('dialog').filter({ has: page.getByRole('link', { name: en['vault.edit'] }) });
  await expect(detailDialog).toBeVisible();
  await detailDialog.getByRole('button', { name: en['common.close'] }).click();
  await expect(detailDialog).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('dialog', { name: en['search.title'] })).toBeHidden();

  const reopened = await openSearch(page);
  await expect(reopened.input).toHaveValue('');
  await expect(reopened.dialog.getByRole('option')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: new RegExp(en['search.trigger']) })).toBeFocused();

  await context.setOffline(true);
  const offlineSearch = await openSearch(page);
  await offlineSearch.input.fill(stamp.toString());
  await expect(
    offlineSearch.dialog.getByRole('option').filter({ hasText: name }).filter({ hasText: username }),
  ).toBeVisible();
  await page.keyboard.press('Enter');
  const offlineDetail = page.getByRole('dialog').filter({ has: page.getByRole('link', { name: en['vault.edit'] }) });
  await expect(offlineDetail).toBeVisible();
  await offlineDetail.getByRole('button', { name: en['common.close'] }).click();
  await expect(offlineDetail).toBeHidden({ timeout: 15_000 });
  await context.setOffline(false);
});
