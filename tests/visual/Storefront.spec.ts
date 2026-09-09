import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { LOCAL_STOREFRONT_ORIGIN } from '@shop/config/client';
import { ROUTES } from '../../apps/storefront/src/generated/RouteBinding';
import { signInStorefront } from '../browser/Environment';
import { expectWcagAA } from '../browser/Accessibility';
import { expectUsable, fillRoute, prepareVisual, resetVisual } from './Runtime';

const viewports = Object.freeze([
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]);

for (const viewport of viewports) {
  test(`Storefront 首页、目录与购物车在 ${viewport.width}px 可完成核心浏览`, async ({ page }) => {
    await prepareVisual(page, viewport);
    await signInStorefront(page, '/');
    for (const routeid of ['storehome', 'storecatalog', 'storecart'] as const) {
      resetVisual(page);
      await page.goto(url(ROUTES[routeid]));
      await expectUsable(page);
      await expectWcagAA(page);
      if (routeid === 'storehome') {
        await expect(page.getByRole('img', { name: '暖心生活关怀礼盒' })).toBeVisible();
        await expect(page.getByRole('img', { name: '工作日营养餐券' })).toBeVisible();
        await expect(page.getByRole('img', { name: '全国通兑电影票' })).toBeVisible();
        if (viewport.width < 1024) await expectMobileHomePattern(page);
      }
    }
  });
}

test('Storefront 所有正式路由以真实 Commerce 数据可达', async ({ page }) => {
  test.slow();
  await prepareVisual(page, { width: 1440, height: 900 });
  await signInStorefront(page);
  for (const [routeid, template] of Object.entries(ROUTES)) {
    await test.step(routeid, async () => {
      resetVisual(page);
      await page.goto(url(template));
      await expectUsable(page);
    });
  }
});

test('三主题权威、中文长文案和 200% 字号不会造成水平裁切', async ({ page }) => {
  await prepareVisual(page, { width: 390, height: 844 });
  await signInStorefront(page, '/catalog');
  expect(parse(readFileSync('config/visuals.yml', 'utf8')).themes).toEqual(['shop', 'market', 'governance']);
  await page.locator('main').evaluate((main) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = '这是用于验证福利商城在超长中文业务说明、异常金额和大字号环境下仍然能够完整阅读并顺利操作的验收文案。'.repeat(4);
    main.prepend(paragraph);
  });
  await page.addStyleTag({ content: 'html{font-size:200% !important}' });
  await expectUsable(page);
});

function url(template: string): string {
  return `${LOCAL_STOREFRONT_ORIGIN}/s/zhudatuan-local${fillRoute(template, { productId: 'listing:mall-zhudatuan:sku:visual:care', orderId: 'order:visual:missing', paymentId: 'payment:visual:missing', caseId: 'case:visual:missing' })}`;
}

async function expectMobileHomePattern(page: import('@playwright/test').Page) {
  const landmarks = [
    page.getByRole('region', { name: '当前企业福利商城' }),
    page.locator('[data-home-layout="mobile"]').getByRole('region'),
    page.getByRole('navigation', { name: '商城快捷入口' }),
    page.locator('main h1').first(),
    page.getByRole('region', { name: '福利场景' }),
    page.getByRole('heading', { name: '员工严选' }),
  ];
  for (const landmark of landmarks) await expect(landmark).toBeVisible();
  const positions = await Promise.all(landmarks.map(async (landmark) => (await landmark.boundingBox())?.y ?? Number.POSITIVE_INFINITY));
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
}
