import { test } from '@playwright/test';
import { LOCAL_AUTH_ORIGIN } from '@shop/config/client';
import { ROUTES } from '../../apps/storefront/src/generated/RouteBinding';
import { signInStorefront } from '../browser/Environment';
import { applyDoubleTextScale, expectWcagAA } from '../browser/Accessibility';
import { expectResponsivePage } from '../browser/Environment';
import { expectVisualReady } from '../../scripts/check/VisualIntegrity';

test('身份页在减少动效和 WCAG 2.2 AA 对比度下通过', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto(`${LOCAL_AUTH_ORIGIN}/?target=storefront`);
  await expectWcagAA(page);
});

test('商城在 200% 字号与移动视口下仍满足 AA 且无水平裁切', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signInStorefront(page, ROUTES.storecatalog);
  await expectVisualReady(page);
  await applyDoubleTextScale(page);
  await expectResponsivePage(page);
  await expectWcagAA(page);
});
