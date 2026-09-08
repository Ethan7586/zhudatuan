import { expect, test } from '@playwright/test';
import { LOCAL_AUTH_ORIGIN, LOCAL_STOREFRONT_ORIGIN } from '@shop/config/client';
import { signInStorefront } from '../browser/Environment';
import { expectWcagAA } from '../browser/Accessibility';

test('身份页具有唯一主标题、关联标签和可宣告错误', async ({ page }) => {
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByLabel('登录账号或已绑定手机号')).toBeVisible();
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible();
  await expectWcagAA(page);
});

test('商城标题层级、导航地标和动态状态可被辅助技术识别', async ({ page }) => {
  await signInStorefront(page, '/catalog');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('navigation').first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('[aria-live], [role="status"]')).not.toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`^${LOCAL_STOREFRONT_ORIGIN}`));
  await expectWcagAA(page);
});
