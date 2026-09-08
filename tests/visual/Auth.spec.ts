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

test('Auth 共享按钮原子保持主次层级、触控尺寸与完整中文', async ({ page }) => {
  await prepareVisual(page, { width: 390, height: 844 });
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await expectUsable(page);

  const primary = page.getByRole('button', { name: '登录并进入消费者商城' });
  const secondary = page.getByRole('button', { name: '忘记密码？' });
  const reveal = page.getByRole('button', { name: '显示密码' });
  for (const control of [primary, secondary, reveal]) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => textFits(primary)).toBe(true);
  await expect(primary).toHaveCSS('background-image', /linear-gradient/);
  await expect(primary).toHaveCSS('box-shadow', 'none');
  await expect(primary).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await expect(primary).toHaveCSS('white-space', 'nowrap');
  expect(await primary.evaluate((element) => getComputedStyle(element).backgroundImage)).not.toContain('20, 58, 143');
  await expect(secondary).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await primary.focus();
  await expect(primary).not.toHaveCSS('box-shadow', 'none');
  await primary.blur();

  const revealTransform = await reveal.evaluate((element) => getComputedStyle(element).transform);
  await reveal.hover();
  expect(await reveal.evaluate((element) => getComputedStyle(element).transform)).toBe(revealTransform);
});

async function textFits(locator: import('@playwright/test').Locator): Promise<boolean> {
  return locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1);
}
