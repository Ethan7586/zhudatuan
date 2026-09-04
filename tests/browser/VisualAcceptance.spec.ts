import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { LOCAL_AUTH_ORIGIN, LOCAL_CONSOLE_ORIGIN, LOCAL_STOREFRONT_ORIGIN } from '@shop/config/client';
import { ROUTES as AUTH_ROUTES } from '../../apps/auth/src/generated/RouteBinding';
import { ROUTES as CONSOLE_ROUTES } from '../../apps/console/src/generated/RouteBinding';
import { ROUTES as STOREFRONT_ROUTES } from '../../apps/storefront/src/generated/RouteBinding';
import { expectWcagAA } from './Accessibility';
import { expectResponsivePage, signInConsole, signInStorefront } from './Environment';

interface VisualAuthority {
  readonly viewports: Readonly<Record<string, Readonly<{ width: number; height: number }>>>;
  readonly surfaces: Readonly<Record<'auth' | 'console' | 'storefront', Readonly<{ routes: readonly Readonly<{ routeid: string }>[] }>>>;
}

const authority = parse(readFileSync('config/visuals.yml', 'utf8')) as VisualAuthority;
const viewports = Object.entries(authority.viewports);
const runtimeErrors = new WeakMap<Page, string[]>();

test('视觉权威精确覆盖生成的 53 条正式路由', () => {
  expect(routeids('auth')).toEqual(Object.keys(AUTH_ROUTES).sort());
  expect(routeids('console')).toEqual(Object.keys(CONSOLE_ROUTES).sort());
  expect(routeids('storefront')).toEqual(Object.keys(STOREFRONT_ROUTES).sort());
  expect(viewports).toHaveLength(8);
});

for (const [name, viewport] of viewports) {
  test(`Auth 全路由在 ${name} 视口可访问`, async ({ page }) => {
    test.slow();
    await prepare(page, viewport);
    for (const [routeid, path] of Object.entries(AUTH_ROUTES)) {
      await test.step(routeid, async () => {
        resetRuntimeErrors(page);
        await page.goto(`${LOCAL_AUTH_ORIGIN}${path}?target=storefront`);
        await expectResponsivePage(page);
        await expectWcagAA(page);
      });
    }
  });

  test(`Console 全路由在 ${name} 视口可访问`, async ({ page }) => {
    test.slow();
    await prepare(page, viewport);
    await signInConsole(page);
    for (const [routeid, template] of Object.entries(CONSOLE_ROUTES)) {
      await test.step(routeid, async () => {
        resetRuntimeErrors(page);
        await page.goto(`${LOCAL_CONSOLE_ORIGIN}${fillConsole(template)}`);
        await expectResponsivePage(page);
        await expectWcagAA(page);
        if (routeid === 'consoleproducts') await expectProductResponsive(page, viewport.width);
        if (routeid === 'consoleorders') await expectOrderResponsive(page, viewport.width);
      });
    }
  });

  test(`Storefront 全路由在 ${name} 视口可访问`, async ({ page }) => {
    test.slow();
    await prepare(page, viewport);
    await signInStorefront(page);
    for (const [routeid, template] of Object.entries(STOREFRONT_ROUTES)) {
      await test.step(routeid, async () => {
        resetRuntimeErrors(page);
        await page.goto(`${LOCAL_STOREFRONT_ORIGIN}/s/zhudatuan-local${fillStorefront(template)}`);
        await expectResponsivePage(page);
        await expectWcagAA(page);
      });
    }
  });
}

function routeids(surface: keyof VisualAuthority['surfaces']): string[] {
  return authority.surfaces[surface].routes.map(({ routeid }) => routeid).sort();
}

async function prepare(page: Parameters<typeof expectResponsivePage>[0], viewport: Readonly<{ width: number; height: number }>): Promise<void> {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

function resetRuntimeErrors(page: Page): void {
  runtimeErrors.get(page)?.splice(0);
}

async function expectProductResponsive(page: Page, width: number): Promise<void> {
  const row = page.locator('.producttablewrap tbody tr').first();
  await expect(row).toBeVisible();
  if (width >= 768 && width <= 1023) {
    const summary = page.getByText('筛选商品', { exact: true });
    await expect(summary).toBeVisible();
    await expect(page.locator('.producttoolbar')).toBeHidden();
    await summary.click();
    await expect(page.locator('.producttoolbar')).toBeVisible();
  }
  if (width < 768) {
    await expect.poll(() => row.evaluate((element) => getComputedStyle(element).display)).toBe('grid');
    await expect(page.locator('.producttablewrap tbody td[data-label]').first()).toBeVisible();
    const undersized = await page.locator('.productheroactions button:visible, .producttoolbar button:visible, .producttoolbar input:visible, .producttoolbar select:visible').evaluateAll((elements) =>
      elements.filter((element) => element.getBoundingClientRect().height < 43.5).map((element) => ({ tag: element.tagName, text: element.textContent }))
    );
    expect(undersized).toEqual([]);
  }

  await page.getByRole('button', { name: '查看' }).first().click();
  const drawer = page.locator('.productdrawer');
  await expect(drawer).toBeVisible();
  const bounds = await drawer.boundingBox();
  expect(bounds).not.toBeNull();
  const drawerWidth = bounds?.width ?? 0;
  if (width <= 1023) {
    expect(Math.abs(drawerWidth - width)).toBeLessThanOrEqual(1);
  } else if (width < 1440) {
    expect(drawerWidth).toBeGreaterThanOrEqual(420);
    expect(drawerWidth).toBeLessThanOrEqual(520);
  } else {
    expect(drawerWidth).toBeGreaterThanOrEqual(480);
    expect(drawerWidth).toBeLessThanOrEqual(640);
  }
  await expect(page.locator('[role="dialog"] [role="dialog"]')).toHaveCount(0);
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
}

async function expectOrderResponsive(page: Page, width: number): Promise<void> {
  const row = page.locator('.ordertablewrap tbody tr').first();
  await expect(row).toBeVisible();
  const disclosure = page.getByText('筛选与查找', { exact: true });
  if (width <= 1023) {
    await expect(disclosure).toBeVisible();
    await expect(page.locator('.ordertoolbar')).toBeHidden();
    await disclosure.click();
    await expect(page.locator('.ordertoolbar')).toBeVisible();
  } else {
    await expect(disclosure).toBeHidden();
    await expect(page.locator('.ordertoolbar')).toBeVisible();
  }
  if (width < 768) {
    await expect.poll(() => row.evaluate((element) => getComputedStyle(element).display)).toBe('grid');
    await expect(page.locator('.ordertablewrap tbody td[data-label]').first()).toBeVisible();
    const undersized = await page.locator('.ordertoolbar button:visible, .ordertoolbar input:visible, .ordertoolbar select:visible, .orderrowactions button:visible').evaluateAll((elements) =>
      elements.filter((element) => element.getBoundingClientRect().height < 43.5).map((element) => ({ tag: element.tagName, text: element.textContent }))
    );
    expect(undersized).toEqual([]);
  }

  await page.getByRole('button', { name: /查看订单/ }).first().click();
  const drawer = page.locator('.orderdrawermodal');
  await expect(drawer).toBeVisible();
  const bounds = await drawer.boundingBox();
  expect(bounds).not.toBeNull();
  const drawerWidth = bounds?.width ?? 0;
  if (width <= 1023) {
    expect(Math.abs(drawerWidth - width)).toBeLessThanOrEqual(1);
  } else if (width < 1440) {
    expect(drawerWidth).toBeGreaterThanOrEqual(420);
    expect(drawerWidth).toBeLessThanOrEqual(520);
  } else {
    expect(drawerWidth).toBeGreaterThanOrEqual(480);
    expect(drawerWidth).toBeLessThanOrEqual(640);
  }
  expect(runtimeErrors.get(page) ?? []).toEqual([]);
}

function fillConsole(template: string): string {
  return fill(template, {
    scopeKind: 'platform',
    scopeId: 'organization-platform-root',
    kind: 'catalog',
    jobId: 'job:visual:missing',
    productId: 'product:visual:care',
    orderId: 'order:visual:missing',
    view: 'settings',
    caseId: 'case:visual:missing',
  });
}

function fillStorefront(template: string): string {
  return fill(template, {
    productId: 'listing:mall-zhudatuan:sku:visual:care',
    orderId: 'order:visual:missing',
    paymentId: 'payment:visual:missing',
    caseId: 'case:visual:missing',
  });
}

function fill(template: string, parameters: Readonly<Record<string, string>>): string {
  return template.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, name: string) => encodeURIComponent(parameters[name] ?? `visual:${name}`));
}
