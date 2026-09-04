import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
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
        await page.goto(`${LOCAL_CONSOLE_ORIGIN}${fillConsole(template)}`);
        await expectResponsivePage(page);
        await expectWcagAA(page);
      });
    }
  });

  test(`Storefront 全路由在 ${name} 视口可访问`, async ({ page }) => {
    test.slow();
    await prepare(page, viewport);
    await signInStorefront(page);
    for (const [routeid, template] of Object.entries(STOREFRONT_ROUTES)) {
      await test.step(routeid, async () => {
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
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
