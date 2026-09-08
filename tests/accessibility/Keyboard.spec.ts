import { expect, test } from '@playwright/test';
import { LOCAL_AUTH_ORIGIN, LOCAL_STOREFRONT_ORIGIN } from '@shop/config/client';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from '../../tools/seed/src/LocalSecrets';
import { ROUTES } from '../../apps/storefront/src/generated/RouteBinding';
import { signInStorefront } from '../browser/Environment';

test('登录表单具有可预测焦点顺序且 Enter 可提交', async ({ page }) => {
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  const account = page.getByLabel('登录账号或已绑定手机号');
  const password = page.getByLabel('密码', { exact: true });
  await expect(account).toBeVisible();
  await account.focus();
  await expect(account).toBeFocused();
  await account.fill('ethan');
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await password.fill(await localSecret(localSeedEnvironment().ethanPasswordRef));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '显示密码' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '忘记密码？' })).toBeFocused();
  await page.getByRole('checkbox', { name: /我已阅读并同意/ }).check();
  await password.focus();
  await password.press('Enter');
  await page.waitForURL(new RegExp(`^${LOCAL_STOREFRONT_ORIGIN}/`), { waitUntil: 'commit' });
});

test('移动端筛选抽屉锁定焦点并在关闭后恢复到触发按钮', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInStorefront(page, ROUTES.storecatalog);
  const trigger = page.getByRole('button', { name: '打开筛选' });
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`^${LOCAL_STOREFRONT_ORIGIN}`));
});
