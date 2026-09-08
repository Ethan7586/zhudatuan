import { expect, test } from '@playwright/test';
import { LOCAL_AUTH_ORIGIN } from '@shop/config/client';
import { ROUTES } from '../../apps/auth/src/generated/RouteBinding';
import { expectWcagAA } from '../browser/Accessibility';
import { expectUsable, prepareVisual, resetVisual } from './Runtime';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Auth 登录、邀请、身份选择与恢复在 ${viewport.width}px 可理解`, async ({ page }) => {
    await prepareVisual(page, viewport);
    for (const [routeid, path] of Object.entries(ROUTES)) {
      await test.step(routeid, async () => {
        resetVisual(page);
        await page.goto(`${LOCAL_AUTH_ORIGIN}${path}?target=storefront`);
        await expectUsable(page);
        await expectWcagAA(page);
      });
    }
  });
}

test('Auth 错误文案不暴露代码且键盘可完成登录表单', async ({ page }) => {
  await prepareVisual(page, { width: 390, height: 844 });
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await page.getByLabel('登录账号或已绑定手机号').fill('不存在的账号');
  await page.getByLabel('密码', { exact: true }).fill('Wrong-password-1!');
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await page.getByRole('button', { name: /登录并进入/ }).press('Enter');
  await expect(page.locator('[role="alert"]')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/AUTHENTICATION_|INTERNAL_ERROR|TypeError|SQLSTATE/);
});
