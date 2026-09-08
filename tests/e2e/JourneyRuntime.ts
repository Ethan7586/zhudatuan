import { expect, test, type Page } from '@playwright/test';
import { CONTRACT_VERSION, OperationCatalog, type OperationId, type OperationTarget } from '@shop/contract';
import { LOCAL_API_ORIGIN, LOCAL_CONSOLE_ORIGIN, LOCAL_STOREFRONT_ORIGIN } from '@shop/config/client';
import { expectResponsivePage, signInConsole, signInStorefront } from '../browser/Environment';

export interface JourneyPlan {
  readonly scenario: string;
  readonly path: string;
  readonly assertions: readonly string[];
  readonly operations: readonly OperationId[];
}

export async function runConsoleJourney(page: Page, plan: JourneyPlan): Promise<void> {
  test.setTimeout(120_000);
  await signInConsole(page);
  await run(page, plan, 'console', LOCAL_CONSOLE_ORIGIN, `/scopes/platform/organization-platform-root${plan.path}`);
}

export async function runStorefrontJourney(page: Page, plan: JourneyPlan): Promise<void> {
  test.setTimeout(120_000);
  await signInStorefront(page, plan.path);
  await run(page, plan, 'storefront', LOCAL_STOREFRONT_ORIGIN, `/s/zhudatuan-local${plan.path}`);
}

async function run(page: Page, plan: JourneyPlan, target: OperationTarget, origin: string, path: string): Promise<void> {
  await test.step(`${plan.scenario} · 打开真实任务入口`, async () => {
    await page.goto(`${origin}${path}`, { waitUntil: 'commit' });
    await page.locator('main:visible').first().waitFor({ state: 'visible', timeout: 20_000 });
    await expectResponsivePage(page);
    const copy = await page.locator('body').innerText();
    expect(copy).not.toMatch(/(?:Cannot read properties|Unexpected Application Error|SELECT\s+.+\s+FROM|SCOPE_DENIED|AUTHORIZATION_DENIED)/i);
  });

  const results: Readonly<{ registered: boolean; safe: boolean }>[] = [];
  for (const operation of plan.operations) results.push(await probeOperation(page, operation, target, origin));
  expect(results).toHaveLength(plan.operations.length);
  for (const assertion of plan.assertions) {
    await test.step(assertion, async () => {
      await expect(page.locator('main:visible').first()).toBeVisible();
      expect(results.every(({ registered, safe }) => registered && safe)).toBe(true);
    });
  }
}

async function probeOperation(page: Page, operation: OperationId, target: OperationTarget, origin: string): Promise<Readonly<{ registered: boolean; safe: boolean }>> {
  const definition = OperationCatalog.get(operation);
  const path = definition.path.replace(/\{([a-z][a-z0-9]*)\}/g, (_match, parameter: string) => encodeURIComponent(missingResource(parameter)));
  const cookies = await page.context().cookies(LOCAL_API_ORIGIN);
  const csrf = cookies.find(({ name }) => name === `__Host-${target}-csrf`)?.value;
  const write = definition.method !== 'GET';
  const headers: Record<string, string> = {
    accept: 'application/json',
    origin,
    'x-client-target': target,
    'x-client-version': '1.0.0-e2e',
    'x-contract-version': CONTRACT_VERSION,
    'x-scope-hint': 'organization-platform-root',
    'x-trace-id': crypto.randomUUID(),
    ...(write ? { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), 'if-match': '"0"' } : {}),
    ...(write && csrf ? { 'x-csrf-token': csrf } : {}),
  };
  const response = await page.request.fetch(`${LOCAL_API_ORIGIN}${path}`, {
    method: definition.method,
    headers,
    ...(write ? { data: {} } : {}),
    failOnStatusCode: false,
    timeout: Math.max(10_000, definition.timeout * 4),
  });
  const body = await response.text();
  const registered = response.status() !== 405 && response.status() !== 501 && (response.status() !== 404 || body.includes('RESOURCE_NOT_FOUND'));
  const safe = response.status() < 500 && !/(?:SQLSTATE|node_modules|at [A-Za-z0-9_.]+ \(|SELECT\s+.+\s+FROM|PRIVATE KEY)/i.test(body);
  expect(registered, `${operation} is not registered`).toBe(true);
  expect(safe, `${operation} leaked an unsafe failure`).toBe(true);
  return Object.freeze({ registered, safe });
}

function missingResource(parameter: string): string {
  const known: Readonly<Record<string, string>> = {
    mallid: 'mall-zhudatuan',
    productid: 'product:visual:care',
    orderid: 'order:missing:e2e',
    caseid: 'ticket:missing:e2e',
    templateid: 'template:missing:e2e',
    assignmentid: 'assignment:missing:e2e',
  };
  return known[parameter] ?? `${parameter}:missing:e2e`;
}
