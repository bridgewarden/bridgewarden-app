import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { E2E_ADMIN, unlockVault, waitForHydration } from './fixtures';

const MEMBER_EMAIL = 'member@example.com';
const MEMBER_PASSWORD = 'member master password 123';

test('admin invites a member, member sets up, admin disables them', async ({ browser, page }) => {
  await page.goto('/login');
  await waitForHydration(page);
  await page.getByLabel(en['login.email']).fill(E2E_ADMIN.email);
  await page.getByLabel(en['login.password']).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['login.submit'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.goto('/admin/users');
  await waitForHydration(page);
  await unlockVault(page);
  await page.getByLabel(en['adminUsers.email']).fill(MEMBER_EMAIL);
  await page.getByLabel(en['adminUsers.displayName']).fill('Member');
  await page.getByRole('button', { name: en['adminUsers.createInvitation'] }).click();

  const setupLink = page.getByLabel(en['adminUsers.setupLink']);
  await expect(setupLink).toBeVisible();
  const url = (await setupLink.inputValue()).replace('http://localhost:5173', 'http://localhost:8787');

  const memberContext = await browser.newContext({ baseURL: 'http://localhost:8787' });
  const member = await memberContext.newPage();
  await member.goto(url);
  await waitForHydration(member);
  await expect(member.getByRole('heading', { name: en['memberSetup.title'] })).toBeVisible();
  await member.getByLabel(en['memberSetup.password'], { exact: true }).fill(MEMBER_PASSWORD);
  await member.getByLabel(en['memberSetup.confirmPassword']).fill(MEMBER_PASSWORD);
  await member.getByRole('button', { name: en['memberSetup.generate'] }).click();

  const recoveryKey = (await member.locator('#member-recovery-key').textContent())!.trim();
  await member.getByLabel(en['memberSetup.recoveryConfirm']).fill(recoveryKey.replaceAll('-', '').slice(0, 6));
  await member.getByRole('button', { name: en['memberSetup.submit'] }).click();
  await expect(member).toHaveURL(/\/app$/);

  await page.reload();
  await unlockVault(page);
  const memberRow = page.getByRole('row', { name: new RegExp(MEMBER_EMAIL) });
  await expect(memberRow).toBeVisible();
  await memberRow.getByRole('button', { name: en['adminUsers.disable'] }).click();
  await expect(memberRow.getByRole('button', { name: en['adminUsers.enable'] })).toBeVisible();

  await member.goto('/app');
  await expect(member).toHaveURL(/\/login\?next=/);
  await memberContext.close();
});
