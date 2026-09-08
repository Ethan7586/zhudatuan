import { test } from '@playwright/test';
import { LOCAL_STORE_ORIGIN } from '@shop/config/client';
import { ROUTES } from '../../apps/store/src/generated/RouteBinding';
import { signInSurface } from '../browser/Environment';
import { expectWcagAA } from '../browser/Accessibility';
import { expectUsable, fillRoute, prepareVisual, resetVisual } from './Runtime';

for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 768, height: 900 }, { width: 390, height: 844 }]) {
  test(`门店扫码、订单、核验和交班在 ${viewport.width}x${viewport.height} 可操作`, async ({ page }) => {
    test.slow();
    await prepareVisual(page, viewport);
    const start = route(ROUTES.storetasks);
    await signInSurface(page, 'store', LOCAL_STORE_ORIGIN, start);
    for (const [routeid, template] of Object.entries(ROUTES)) {
      await test.step(routeid, async () => {
        resetVisual(page);
        await page.goto(`${LOCAL_STORE_ORIGIN}${route(template)}`);
        await expectUsable(page);
        await expectWcagAA(page);
      });
    }
  });
}

function route(template: string): string {
  return fillRoute(template, { scopeKind: 'store', scopeId: 'store-local', orderId: 'order:visual:missing', caseId: 'case:visual:missing' });
}
