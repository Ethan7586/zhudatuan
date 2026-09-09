import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { parse } from 'yaml';
import { LOCAL_CONSOLE_ORIGIN } from '@shop/config/client';
import { ROUTES } from '../../apps/console/src/generated/RouteBinding';
import { signInConsole } from '../browser/Environment';
import { expectWcagAA } from '../browser/Accessibility';
import { expectUsable, fillRoute, prepareVisual, resetVisual } from './Runtime';

type ScopeKind = 'platform' | 'distributor' | 'enterprise' | 'mall';
interface NavigationAuthority {
  readonly nodes: readonly Readonly<{ surface: string; scope: ScopeKind; routeid: string }>[];
}

const authority = parse(readFileSync('config/navigation.yml', 'utf8')) as NavigationAuthority;
const scopes = Object.freeze({
  platform: 'organization-platform-root',
  distributor: 'distributor-local-zhudatuan',
  enterprise: 'enterprise-zhudatuan',
  mall: 'mall-zhudatuan',
});
const viewports = Object.freeze([
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]);
const core = Object.freeze([
  ['platform', 'consoleproducts'],
  ['distributor', 'consolecontrol'],
  ['enterprise', 'consoleorders'],
  ['mall', 'consolefinance'],
  ['mall', 'consoleaccess'],
  ['mall', 'consolevouchers'],
  ['mall', 'consoleexperience'],
] as const);

test('Console 路由由导航权威分配到四类 Scope 而非硬编码平台层', () => {
  const configured = new Set(authority.nodes.filter(({ surface }) => surface === 'console').map(({ routeid }) => routeid));
  expect([...Object.keys(ROUTES)].every((routeid) => configured.has(routeid))).toBe(true);
  expect(new Set(authority.nodes.filter(({ surface }) => surface === 'console').map(({ scope }) => scope))).toEqual(new Set(Object.keys(scopes)));
});

const routeShards = Object.freeze(Array.from({ length: 4 }, (_, shard) => Object.entries(ROUTES).filter((_, index) => index % 4 === shard)));

for (const [shard, routes] of routeShards.entries()) {
  test(`Console 所有正式路由可达（分片 ${shard + 1}/${routeShards.length}）`, async ({ page }) => {
    test.slow();
    await prepareVisual(page, { width: 1280, height: 800 });
    await signInConsole(page);
    expect(routes.length).toBeGreaterThan(0);
    for (const [routeid, template] of routes) {
      await test.step(routeid, async () => {
        resetVisual(page);
        const scope = canonicalScope(routeid);
        await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(template, scope)}`);
        await expectUsable(page);
      });
    }
  });
}

for (const viewport of viewports) {
  test(`Console 核心工作台在 ${viewport.width}px、四 Scope 和真实数据下可操作`, async ({ page }) => {
    test.slow();
    await prepareVisual(page, viewport);
    await signInConsole(page);
    for (const [scope, routeid] of core) {
      await test.step(`${scope}:${routeid}`, async () => {
        resetVisual(page);
        await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES[routeid], scope)}`);
        await expectUsable(page);
        await expectWcagAA(page);
      });
    }
  });
}

test('Console 未登录、缺失资源和小屏状态均有可恢复反馈', async ({ page }) => {
  await prepareVisual(page, { width: 390, height: 844 });
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consoleorders, 'mall')}`);
  await expect(page).toHaveURL(/127\.0\.0\.1:3002/);
  await signInConsole(page);
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${fillRoute(ROUTES.consoleorderdetail, { scopeKind: 'mall', scopeId: scopes.mall, orderId: 'order:visual:missing' })}`);
  await expectUsable(page);
  await expect(page.locator('body')).not.toContainText(/Error:|TypeError|SQLSTATE|INTERNAL_ERROR/);
});

test('Console 页名、说明、品牌与管理范围在紧凑桌面和平板完整可读', async ({ page }) => {
  await prepareVisual(page, { width: 1280, height: 800 });
  await signInConsole(page);
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consolefinanceinvoice, 'enterprise')}`);
  await expectUsable(page);
  await expect.poll(() => textFits(page, '.consoleheadersummary')).toBe(true);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consoleorders, 'enterprise')}`);
  await expectUsable(page);
  await expect(page.locator('.consolebreadcrumb > strong')).toHaveText('订单管理系统');
  await expect.poll(() => textFits(page, '.consolebreadcrumb > strong')).toBe(true);
  await expect.poll(() => textFits(page, '.consoleheadersummary')).toBe(true);
  await expect.poll(() => textFits(page, '.sidebarbrandcopy strong')).toBe(true);
  await expect.poll(() => textFits(page, '.scopepath li[aria-current="page"]')).toBe(true);
});

test('Console 设置首页按业务任务分组并随视口重排', async ({ page }) => {
  await prepareVisual(page, { width: 1440, height: 900 });
  await signInConsole(page);
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consolesettings, 'enterprise')}`);
  await expectUsable(page);
  await expect(page.locator('.settingsworkspace')).toHaveCSS('display', 'grid');
  await expect(page.locator('.settingshero')).toHaveCSS('display', 'grid');
  await expect(page.locator('.settingsgrid').first()).toHaveCSS('display', 'grid');
  expect(await page.locator('.settingsgroup').count()).toBeGreaterThan(1);
  expect(await columnCount(page, '.settingsgrid')).toBeGreaterThan(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => columnCount(page, '.settingsgrid')).toBe(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('Console 分销与返佣页签在桌面和手机均可清晰触控', async ({ page }) => {
  await prepareVisual(page, { width: 1440, height: 900 });
  await signInConsole(page);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consolereferral, 'enterprise')}`);
    await expectUsable(page);
    await expect(page.locator('.referraltabs button')).toHaveCount(6);
    await expect.poll(() => minimumHeight(page, '.referraltabs button')).toBeGreaterThanOrEqual(44);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
});

test('Console 窄屏页脚只保留服务状态且不覆盖工作区', async ({ page }) => {
  await prepareVisual(page, { width: 390, height: 844 });
  await signInConsole(page);
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consoleproducts, 'enterprise')}`);
  await expectUsable(page);
  await expect(page.locator('.scopepath')).toBeHidden();
  await expect(page.locator('.scopestatus')).toBeHidden();
  await expect(page.locator('#consolescope')).toBeVisible();
  await expect(page.locator('.consolefooterscope')).toBeHidden();
  await expect(page.locator('.consolefooterhint')).toBeHidden();
  await expect(page.locator('.consolefooterstatus')).toBeVisible();
  await expect.poll(() => elementFitsParent(page, '.consolefooterstatus', '.consolefooter')).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('Console 平板和手机壳层控件保持完整触控目标', async ({ page }) => {
  await prepareVisual(page, { width: 768, height: 1024 });
  await signInConsole(page);
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consoleproducts, 'enterprise')}`);
  await expectUsable(page);
  await expect.poll(() => minimumHeight(page, '.commandtrigger, #consolescope, #consoleperiod')).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.commandtrigger')).toBeHidden();
  await expect(page.locator('#consoleperiod')).toBeHidden();
  await expect.poll(() => minimumHeight(page, '#consolescope')).toBeGreaterThanOrEqual(44);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('Console 商品治理台在桌面、平板和手机保持清晰布局与触控尺寸', async ({ page }) => {
  test.slow();
  await prepareVisual(page, { width: 1366, height: 768 });
  await signInConsole(page);
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consoleproducts, 'enterprise')}`);
    await expectUsable(page);
    await expect(page.locator('.producttablewrap tbody tr').first()).toBeVisible();
    await expect(page.locator('.productservertime')).toHaveText('商品数据已是最新');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await expect.poll(() => minimumHeight(page, '.productheroactions button')).toBeGreaterThanOrEqual(44);
    if (viewport.width <= 768) {
      await expect(page.locator('.producttablewrap tbody tr').first()).toHaveCSS('display', 'grid');
      await expect.poll(() => elementFitsParent(page, '.producttablewrap tbody .productchecktarget', '.producttablewrap tbody tr')).toBe(true);
      await expect.poll(() => textFits(page, '.productfilterdisclosure > summary > span')).toBe(true);
      await expect.poll(() => textFits(page, '.productfilterdisclosure > summary > small')).toBe(true);
      await page.locator('.productfilterdisclosure > summary').click();
      await expect(page.locator('.producttoolbar')).toBeVisible();
      await expect.poll(() => minimumHeight(page, '.producttoolbar :is(button, input, select)')).toBeGreaterThanOrEqual(44);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    } else {
      await expect(page.locator('.producttablewrap tbody tr').first()).toHaveCSS('display', 'table-row');
    }
  }
});

test('Console 订单列表在平板和手机转为完整可触控卡片', async ({ page }) => {
  test.slow();
  await prepareVisual(page, { width: 768, height: 1024 });
  await signInConsole(page);
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consoleorders, 'enterprise')}`);
    await expectUsable(page);
    await expect(page.locator('.ordertable tbody tr').first()).toHaveCSS('display', 'grid');
    await expect.poll(() => page.locator('.ordertablewrap').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect.poll(() => minimumHeight(page, '.orderrowactions button')).toBeGreaterThanOrEqual(44);
    await expect.poll(() => minimumWidth(page, '.orderrowactions button')).toBeGreaterThanOrEqual(44);
  }
});

test('Console 数据报表在桌面、平板和手机保持可读且无需横向拖动', async ({ page }) => {
  test.slow();
  await prepareVisual(page, { width: 1366, height: 768 });
  await signInConsole(page);
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consolereporting, 'enterprise')}`);
    await expectUsable(page);
    await expect(page.getByRole('table', { name: '报表指标' })).toBeVisible();
    await expect(page.locator('.reportcontent tbody tr').first()).toBeVisible();
    await expect.poll(() => minimumHeight(page, '.reportpage :is(button, input, select)')).toBeGreaterThanOrEqual(44);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    if (viewport.width <= 768) {
      await expect(page.locator('.reportcontent tbody tr').first()).toHaveCSS('display', 'grid');
      await expect.poll(() => page.locator('.reportcontent .tablewrap').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expect(page.locator('.reportcontent tbody td[data-label="维度"]').first()).toBeVisible();
    } else {
      await expect(page.locator('.reportcontent tbody tr').first()).toHaveCSS('display', 'table-row');
    }
  }
});

test('Console 客服工作台按可用空间从三栏重排为两栏和单栏', async ({ page }) => {
  test.slow();
  await prepareVisual(page, { width: 1440, height: 900 });
  await signInConsole(page);
  await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consolesupport, 'enterprise')}`);
  await expectUsable(page);
  await expect.poll(() => columnCount(page, '.supportdesk')).toBe(3);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => columnCount(page, '.supportdesk')).toBe(2);
  await expect(page.locator('.supportcontext')).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.supportdesk')).toHaveCSS('display', 'block');
    await expect(page.locator('.supportqueue')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
});

test('Console 商城管理在平板和手机将宽表转为可读卡片', async ({ page }) => {
  test.slow();
  await prepareVisual(page, { width: 768, height: 1024 });
  await signInConsole(page);
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${LOCAL_CONSOLE_ORIGIN}${path(ROUTES.consoleexperience, 'enterprise')}`);
    await expectUsable(page);
    await expect(page.locator('.commerceownership')).toHaveCSS('display', 'grid');
    await expect.poll(() => minimumWidth(page, '.commerceownership > div')).toBeGreaterThan(160);
    await expect(page.locator('.commerceboard tbody tr').first()).toHaveCSS('display', 'grid');
    await expect.poll(() => page.locator('.commerceboard .tablewrap').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect.poll(() => minimumHeight(page, '.commerceboard tbody .commerceactions > .commercerowaction')).toBeGreaterThanOrEqual(44);
    await expect.poll(() => minimumWidth(page, '.commercetabs button')).toBeGreaterThanOrEqual(44);
    await expect.poll(() => minimumWidth(page, '.commerceactions > .commercerowaction, .commerceactions > .commerceactionmore > summary')).toBeGreaterThanOrEqual(44);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
});

function canonicalScope(routeid: string): ScopeKind {
  const declared = authority.nodes.filter((node) => node.surface === 'console' && node.routeid === routeid).map(({ scope }) => scope);
  const preferred: readonly ScopeKind[] = routeid.startsWith('consolereferral') ? ['distributor', 'enterprise', 'mall', 'platform'] : ['enterprise', 'mall', 'platform', 'distributor'];
  const selected = preferred.find((scope) => declared.includes(scope));
  if (!selected) throw new Error(`VISUAL_SCOPE_MISSING:${routeid}`);
  return selected;
}

function path(template: string, scope: ScopeKind): string {
  return fillRoute(template, { scopeKind: scope, scopeId: scopes[scope], kind: 'catalog', jobId: 'job:visual:missing', productId: 'product:visual:care', orderId: 'order:visual:missing', view: 'settings', caseId: 'case:visual:missing' });
}

async function textFits(page: import('@playwright/test').Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((element) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1);
}

async function columnCount(page: import('@playwright/test').Page, selector: string): Promise<number> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
}

async function elementFitsParent(page: import('@playwright/test').Page, selector: string, parent: string): Promise<boolean> {
  const childBox = await page.locator(selector).first().boundingBox();
  const parentBox = await page.locator(parent).first().boundingBox();
  if (!childBox || !parentBox) return false;
  return childBox.x >= parentBox.x && childBox.y >= parentBox.y && childBox.x + childBox.width <= parentBox.x + parentBox.width && childBox.y + childBox.height <= parentBox.y + parentBox.height;
}

async function minimumHeight(page: import('@playwright/test').Page, selector: string): Promise<number> {
  return page.locator(selector).evaluateAll((elements) => Math.min(...elements.map((element) => element.getBoundingClientRect().height)));
}

async function minimumWidth(page: import('@playwright/test').Page, selector: string): Promise<number> {
  return page.locator(selector).evaluateAll((elements) => Math.min(...elements.map((element) => element.getBoundingClientRect().width)));
}
