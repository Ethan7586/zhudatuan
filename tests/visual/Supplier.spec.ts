import { test } from '@playwright/test';
import { LOCAL_SUPPLIER_ORIGIN } from '@shop/config/client';
import { ROUTES } from '../../apps/supplier/src/generated/RouteBinding';
import { signInSurface } from '../browser/Environment';
import { expectWcagAA } from '../browser/Accessibility';
import { expectUsable, fillRoute, prepareVisual, resetVisual } from './Runtime';

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
  test(`供应商大表、详情、导入、财务和连接配置在 ${viewport.width}px 可操作`, async ({ page }) => {
    test.slow();
    await prepareVisual(page, viewport);
    const start = route(ROUTES.suppliertasks);
    await signInSurface(page, 'supplier', LOCAL_SUPPLIER_ORIGIN, start);
    for (const [routeid, template] of Object.entries(ROUTES)) {
      await test.step(routeid, async () => {
        resetVisual(page);
        await page.goto(`${LOCAL_SUPPLIER_ORIGIN}${route(template)}`);
        await expectUsable(page);
        await expectWcagAA(page);
      });
    }
  });
}

function route(template: string): string {
  return fillRoute(template, { scopeKind: 'supplier', scopeId: 'supplier-local', productId: 'product:visual:care', caseId: 'case:visual:missing' });
}
