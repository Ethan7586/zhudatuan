import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { LOCAL_STOREFRONT_ORIGIN } from '@shop/config/client';
import { ROUTES } from '../../apps/storefront/src/generated/RouteBinding';
import { signInStorefront } from '../browser/Environment';
import { applyDoubleTextScale, expectWcagAA } from '../browser/Accessibility';
import { expectVisualReady, VISUAL_VIEWPORTS } from '../../scripts/check/VisualIntegrity';
import { expectUsable, fillRoute, prepareVisual, resetVisual } from './Runtime';

for (const viewport of VISUAL_VIEWPORTS) {
  test(`Storefront 首页、目录与购物车在 ${viewport.name} 可完成核心浏览`, async ({ page }) => {
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
        else await expectDesktopHomePattern(page);
      }
      if (routeid === 'storecatalog' && viewport.width < 1024) await expectMobileCatalogPattern(page);
    }
  });

  test(`Storefront 所有正式路由在 ${viewport.name} 均以稳定真实数据接受视觉检查`, async ({ page }) => {
    test.slow();
    await prepareVisual(page, viewport);
    await signInStorefront(page);
    for (const [routeid, template] of Object.entries(ROUTES)) {
      await test.step(routeid, async () => {
        resetVisual(page);
        await page.goto(url(template));
        await expectUsable(page);
        if (viewport.width < 1024) {
          const landingHeader = page.locator('[data-storefront-mobile-home]');
          if (routeid === 'storehome') await expect(landingHeader).toBeVisible();
          else await expect(landingHeader).toHaveCount(0);
        }
      });
    }
  });
}

test('三主题权威、中文长文案和 200% 字号不会造成水平裁切', async ({ page }) => {
  await prepareVisual(page, { width: 390, height: 844 });
  await signInStorefront(page, ROUTES.storecatalog);
  await expectVisualReady(page);
  expect(parse(readFileSync('config/visuals.yml', 'utf8')).themes).toEqual(['shop', 'market', 'governance']);
  await page.locator('main').evaluate((main) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = '这是用于验证福利商城在超长中文业务说明、异常金额和大字号环境下仍然能够完整阅读并顺利操作的验收文案。'.repeat(4);
    main.prepend(paragraph);
  });
  await applyDoubleTextScale(page);
  await expectUsable(page);
});

test('Storefront 安全中心优先展示可理解的设备名称并渐进披露其他会话', async ({ page }) => {
  await prepareVisual(page, { width: 390, height: 844 });
  await signInStorefront(page, '/profile/security');
  await expectUsable(page);
  await expect(page.getByText(/Google Chrome/).first()).toBeVisible();
  await expect(page.getByText(/当前安全状态：/)).toBeVisible();
  expect(await page.locator('[data-security-device]').count()).toBeLessThanOrEqual(4);
  await expect(page.locator('main')).not.toContainText(/L[0-9]/);
});

for (const width of [390, 360]) {
  test(`Storefront 订单中心在 ${width}px 保持设计稿层级和单行操作`, async ({ page }) => {
    await prepareVisual(page, { width, height: 844 });
    await signInStorefront(page, '/orders');
    await expectUsable(page);
    const filters = page.getByRole('navigation', { name: '订单状态筛选' });
    for (const label of ['全部', '待付款', '待发货', '待收货', '已完成']) await expect(filters.getByRole('button', { name: label, exact: true })).toBeVisible();
    const card = page.locator('[data-order-card]').first();
    await expect(card).toBeVisible();
    const bounds = await card.boundingBox();
    expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(width + 1);
    const actions = card.locator('footer button');
    for (let index = 0; index < (await actions.count()); index += 1) {
      const action = actions.nth(index);
      const metrics = await action.evaluate((element) => ({ width: element.clientWidth, content: element.scrollWidth, height: element.getBoundingClientRect().height, whiteSpace: getComputedStyle(element).whiteSpace }));
      expect(metrics.content).toBeLessThanOrEqual(metrics.width + 1);
      expect(metrics.height).toBeGreaterThanOrEqual(44);
      expect(metrics.whiteSpace).toBe('nowrap');
    }
  });

  test(`Storefront 结算商品信息在 ${width}px 保持可读且操作不被压缩`, async ({ page }) => {
    await prepareVisual(page, { width, height: 844 });
    await signInStorefront(page, '/checkout');
    await expectUsable(page);
    const item = page.locator('[data-checkout-item]').first();
    await expect(item).toBeVisible();
    const copy = await item.locator('[data-checkout-copy]').boundingBox();
    expect(copy?.width ?? 0).toBeGreaterThanOrEqual(130);
    for (const action of ['减少', '增加', '移除']) {
      const target = item.getByRole('button', { name: new RegExp(action) });
      const box = await target.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test(`Storefront 商品详情在 ${width}px 延续设计稿并保持购买操作可达`, async ({ page }) => {
    await prepareVisual(page, { width, height: 844 });
    await signInStorefront(page, '/products/product:visual:care');
    await expectUsable(page);
    await expect(page.getByRole('img', { name: '暖心生活关怀礼盒' })).toBeVisible();
    const actions = page.locator('[data-product-actions]');
    await actions.scrollIntoViewIfNeeded();
    await expect(actions.getByRole('button', { name: '加入购物车' })).toBeVisible();
    await expect(actions.getByRole('button', { name: '立即购买' })).toBeVisible();
    const box = await actions.boundingBox();
    expect((box?.y ?? Number.POSITIVE_INFINITY) + (box?.height ?? 0)).toBeLessThanOrEqual(844 - 68 + 1);
  });
}

function url(template: string): string {
  return `${LOCAL_STOREFRONT_ORIGIN}/s/zhudatuan-local${fillRoute(template, { productId: 'product:visual:care', orderId: 'order:visual:missing', paymentId: 'payment:visual:missing', caseId: 'case:visual:missing' })}`;
}

async function expectMobileHomePattern(page: import('@playwright/test').Page) {
  const landmarks = [
    page.locator('[data-storefront-mobile-home]'),
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

async function expectMobileCatalogPattern(page: import('@playwright/test').Page) {
  await expect(page.locator('[data-catalog-layout="mobile"]')).toBeVisible();
  await expect(page.locator('[data-catalog-layout="desktop"]')).toBeHidden();
  await expect(page.getByRole('heading', { name: '商品分类' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: '商品分类选择' })).toBeVisible();
  await expect(page.getByRole('search').getByRole('textbox', { name: '搜索商品' })).toBeVisible();
  const category = await page.getByRole('navigation', { name: '商品分类选择' }).boundingBox();
  const product = await page.locator('main article').first().boundingBox();
  expect(category ? category.x + category.width : Number.POSITIVE_INFINITY).toBeLessThanOrEqual(product?.x ?? 0);
}

async function expectDesktopHomePattern(page: import('@playwright/test').Page) {
  await expect(page.getByRole('region', { name: '商城公告' })).toBeVisible();
  const categories = page.getByRole('navigation', { name: '商品快捷分类' });
  await expect(categories).toBeVisible();
  const hero = page.locator('main h1').first();
  const product = page.getByRole('heading', { name: '员工严选' });
  const positions = await Promise.all([hero, categories, product].map(async (landmark) => (await landmark.boundingBox())?.y ?? Number.POSITIVE_INFINITY));
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
}
