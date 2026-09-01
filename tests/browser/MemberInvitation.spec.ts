import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { OperationMock } from './OperationMock';
import { CONSOLE_ORIGIN } from './Origins';

const membersPath = '/scopes/platform/platform%3Ae2e/settings/members';

const scenarios = [
  { name: 'wide-1500', viewport: { width: 1500, height: 900 }, expectedWidth: 760 },
  { name: 'standard-1314', viewport: { width: 1314, height: 820 }, expectedWidth: 520 },
  { name: 'narrow-390', viewport: { width: 390, height: 844 }, expectedWidth: 374 },
] as const;

for (const scenario of scenarios) {
  test(`管理员邀请在 ${scenario.name} 保持同一响应式外壳且成功回执不能误关闭`, async ({ page, baseURL }, testInfo) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    await page.setViewportSize(scenario.viewport);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseURL ?? CONSOLE_ORIGIN).origin });
    const api = invitationApi(page);
    await api.install();

    await page.goto(membersPath);
    await expect(page.getByRole('heading', { name: '会员与权限控制中心' })).toBeVisible();
    await page.getByRole('button', { name: '生成管理员邀请码' }).click();

    const formDialog = page.getByRole('dialog', { name: '生成管理员邀请码' });
    await expect(formDialog).toBeVisible();
    await expectDialogWidth(formDialog, scenario.expectedWidth);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolation(page);
    await page.screenshot({ path: testInfo.outputPath(`${scenario.name}-form.png`) });

    await formDialog.getByLabel('目标租户').selectOption('tenant-zhudatuan');
    await formDialog.getByLabel('受邀管理员手机号').fill('13800138000');
    await formDialog.getByLabel('邀请名称').fill('集团运营邀请');
    await formDialog.getByLabel('有效期').selectOption('7');
    await formDialog.getByRole('button', { name: '生成邀请码' }).click();

    const receiptDialog = page.getByRole('dialog', { name: '邀请码已生成' });
    await expect(receiptDialog).toContainText('A'.repeat(32));
    await expectDialogWidth(receiptDialog, scenario.expectedWidth);
    await expect(receiptDialog.getByRole('button', { name: /^关闭$/ })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoSeriousAxeViolation(page);

    await page.keyboard.press('Escape');
    await expect(receiptDialog).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(receiptDialog).toBeVisible();

    await receiptDialog.getByRole('button', { name: '复制邀请码' }).click();
    await expect(receiptDialog.getByRole('status')).toContainText('已复制到剪贴板');
    await page.screenshot({ path: testInfo.outputPath(`${scenario.name}-receipt.png`) });
    await receiptDialog.getByRole('button', { name: '我已保存，关闭' }).click();
    await expect(receiptDialog).toBeHidden();

    const invitationWrite = api.calls.find((call) => call.path === '/api/v1/identity/invitations');
    expect(invitationWrite?.body).toMatchObject({
      tenantId: 'tenant-zhudatuan',
      destination: '13800138000',
      label: '集团运营邀请',
      targetClient: 'operator',
      maxUses: 1,
    });
    expect(api.unmatched).toEqual([]);
    expect(browserErrors).toEqual([]);
  });
}

test('生成请求处理中不能通过关闭按钮、Esc 或遮罩误关', async ({ page }) => {
  await page.setViewportSize({ width: 1314, height: 820 });
  let finishInvitation: (() => void) | undefined;
  const delayedReceipt = new Promise<unknown>((resolve) => {
    finishInvitation = () => resolve(invitationReceipt);
  });
  const api = invitationApi(page, () => delayedReceipt);
  await api.install();

  await page.goto(membersPath);
  await page.getByRole('button', { name: '生成管理员邀请码' }).click();
  const dialog = page.getByRole('dialog', { name: '生成管理员邀请码' });
  await dialog.getByLabel('目标租户').selectOption('tenant-zhudatuan');
  await dialog.getByLabel('受邀管理员手机号').fill('13800138000');
  await dialog.getByRole('button', { name: '生成邀请码' }).click();

  await expect(dialog.getByRole('button', { name: '正在生成…' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '取消' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: /^关闭$/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();

  if (finishInvitation === undefined) throw new Error('INVITATION_TEST_RESOLVER_MISSING');
  finishInvitation();
  await expect(page.getByRole('dialog', { name: '邀请码已生成' })).toContainText('A'.repeat(32));
  expect(api.unmatched).toEqual([]);
});

function invitationApi(page: Page, receipt: unknown = invitationReceipt) {
  return new OperationMock(page).get('/api/v1/identity/session', session).get('/api/v1/members/me', { display_name: 'Ethan', employee_no: null }).get('/api/v1/members', memberPage).post('/api/v1/identity/invitations', receipt, 201);
}

async function expectDialogWidth(dialog: Locator, expectedWidth: number) {
  const width = await dialog.evaluate((element) => element.closest('.dialogpanel')?.getBoundingClientRect().width ?? 0);
  expect(Math.round(width)).toBe(expectedWidth);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

async function expectNoSeriousAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).include('.dialogpanel').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([]);
}

const platformScope = { kind: 'platform', id: 'platform:e2e', name: '测试平台' } as const;
const tenantScope = { kind: 'tenant', id: 'tenant-zhudatuan', tenant: 'tenant-zhudatuan', name: '築大团' } as const;
const session = Object.freeze({
  actor: 'actor:owner:e2e',
  membership: 'membership:owner:e2e',
  accessVersion: 7,
  permissions: ['member.read', 'identity.invitation.manage'],
  capabilities: ['member.members.read', 'identity.invitations.create'],
  assurance: { level: 2, verified: 'password' },
  csrf: 'csrf-token-for-invitation',
  target: 'console',
  scope: platformScope,
  scopes: [platformScope, tenantScope],
  syncedAt: '2026-09-01T04:00:00.000Z',
});

const memberPage = Object.freeze({
  items: [
    {
      id: 'member:owner:e2e',
      display_name: 'Ethan',
      status: 'active',
      membership_id: 'membership:owner:e2e',
      employee_no: null,
      membership_status: 'active',
      access_version: '7',
      joined_at: '2026-08-29T00:00:00.000Z',
      principal_id: 'actor:owner:e2e',
      principal_version: '11',
      client: 'operator',
      login_identity_bound: true,
      reset_allowed: false,
      reset_block_reason: 'OWNER_PROTECTED',
    },
  ],
  count: 1,
});

const invitationReceipt = Object.freeze({
  id: 'invite:e2e',
  code: 'A'.repeat(32),
  label: '集团运营邀请',
  target: 'console',
  max_uses: 1,
  use_count: 0,
  starts_at: '2026-09-01T04:00:00.000Z',
  expires_at: '2026-09-08T04:00:00.000Z',
  status: 'active',
  created_at: '2026-09-01T04:00:00.000Z',
  version: '0',
});
