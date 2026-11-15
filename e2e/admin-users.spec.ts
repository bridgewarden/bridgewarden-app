import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { expectNoSeriousA11yViolations } from './a11y';
import { E2E_ADMIN, E2E_MEMBER, unlockVault, waitForHydration } from './fixtures';
import { assertNoOverflow } from './layout';

const { email: MEMBER_EMAIL, password: MEMBER_PASSWORD } = E2E_MEMBER;

test('invalid member setup link is generic and actionable', async ({ page }) => {
  await page.goto('/setup/member?token=invalid');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: en['memberSetup.invalid'] })).toBeVisible();
  await expect(page.getByRole('link', { name: en['common.signIn'] })).toBeVisible();
  await expect(page.getByText(MEMBER_EMAIL)).toHaveCount(0);
  await expectNoSeriousA11yViolations(page, 'invalid member setup');
});

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
  await expect(member.getByRole('heading', { name: en['memberSetup.title'] })).toBeFocused();
  await expectNoSeriousA11yViolations(member, 'member setup');

  for (const width of [320, 390, 1440]) {
    await member.setViewportSize({ width, height: 800 });
    await assertNoOverflow(member);
    await expect(member.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(member.locator('[aria-current="step"]')).toHaveCount(1);
  }

  await member.getByLabel(en['memberSetup.password'], { exact: true }).fill(MEMBER_PASSWORD);
  await expect(member.getByRole('progressbar', { name: en['password.strength'] })).toHaveAttribute(
    'aria-valuenow',
    '3',
  );
  await member.getByLabel(en['memberSetup.confirmPassword']).fill(MEMBER_PASSWORD);
  await member.getByRole('button', { name: en['memberSetup.generate'] }).click();
  await expect(member.getByRole('heading', { name: en['memberSetup.recoveryLabel'], level: 2 })).toBeFocused();
  await expect(member.getByRole('button', { name: en['setup.back'] })).toBeVisible();
  await member.getByRole('button', { name: en['setup.back'] }).click();
  await expect(member.getByRole('heading', { name: en['memberSetup.password'], level: 2 })).toBeFocused();
  await member.getByLabel(en['memberSetup.password'], { exact: true }).fill(MEMBER_PASSWORD);
  await member.getByLabel(en['memberSetup.confirmPassword']).fill(MEMBER_PASSWORD);
  await member.getByRole('button', { name: en['memberSetup.generate'] }).click();
  await expect(member.getByRole('heading', { name: en['memberSetup.recoveryLabel'], level: 2 })).toBeFocused();

  await member.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await member.getByRole('button', { name: en['setup.recovery.copy'] }).click();
  await expect(member.getByText(en['setup.recovery.copied'])).toBeVisible();
  const downloadPromise = member.waitForEvent('download');
  await member.getByRole('button', { name: en['setup.recovery.download'] }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('member recovery key download missing');
  const recoveryKey = (await member.locator('#recovery-key').textContent())!.trim();
  expect(await readFile(downloadPath, 'utf8')).toContain(recoveryKey);
  await member.getByLabel(en['memberSetup.recoveryConfirm']).fill(recoveryKey.replaceAll('-', '').slice(0, 6));
  await member.getByRole('button', { name: en['memberSetup.submit'] }).click();
  await expect(member).toHaveURL(/\/app$/);

  await page.reload();
  await unlockVault(page);
  const memberRow = page.getByRole('row', { name: new RegExp(MEMBER_EMAIL) });
  await expect(memberRow).toBeVisible();
  const roleSelect = memberRow.getByLabel(`${en['adminUsers.role']} — ${MEMBER_EMAIL}`);
  const roleResponse = page.waitForResponse(
    (response) => response.url().includes('/role') && response.request().method() !== 'GET',
  );
  await roleSelect.selectOption('admin');
  await roleResponse;
  await expect(roleSelect).toHaveValue('admin');
  const revokeResponse = page.waitForResponse(
    (response) => response.url().includes('/revoke') && response.request().method() !== 'GET',
  );
  await memberRow.getByRole('button', { name: en['adminUsers.revokeSessions'] }).click();
  await revokeResponse;
  await member.goto('/app');
  await expect(member).toHaveURL(/\/login/);
  const disableResponse = page.waitForResponse(
    (response) => response.url().includes('/disable') && response.request().method() !== 'GET',
  );
  await memberRow.getByRole('button', { name: en['adminUsers.disable'] }).click();
  await disableResponse;
  await expect(memberRow.getByRole('button', { name: en['adminUsers.enable'] })).toBeVisible();

  await member.goto('/app');
  await expect(member).toHaveURL(/\/login\?next=/);
  await memberContext.close();

  const revokeEmail = `pending-revoke-${Date.now()}@example.com`;
  await page.getByLabel(en['adminUsers.email']).fill(revokeEmail);
  await page.getByLabel(en['adminUsers.displayName']).fill('Pending Revoke');
  await page.getByRole('button', { name: en['adminUsers.createInvitation'] }).click();
  await expect(page.getByLabel(en['adminUsers.setupLink'])).toBeVisible();
  const revokeInvitationResponse = page.waitForResponse(
    (response) => response.url().includes('/invitations/') && response.request().method() !== 'GET',
  );
  await expect(page.getByText(revokeEmail)).toBeVisible();
  await page.getByRole('button', { name: `${en['adminUsers.revokeInvitation']} — ${revokeEmail}` }).click();
  await revokeInvitationResponse;
  await expect(page.getByRole('heading', { name: en['adminUsers.pendingTitle'] })).toBeHidden();
  await expect(page.getByText(revokeEmail)).toBeHidden();
});
