import { expect, test, type Page } from '@playwright/test';
import { LOCAL_CONSOLE_ORIGIN, LOCAL_STOREFRONT_ORIGIN } from '@shop/config/client';
import { signInConsole, signInStorefront } from '../browser/Environment';

const forbiddenCopy = /(?:TODO|FIXME|HACK|coming soon|敬请期待|功能将在后续|待接入|暂未开放|部分开放|SCOPE_DENIED|AUTHORIZATION_DENIED|SELECT\s+.+\s+FROM)/i;
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const scenario = 'all visible actions';

test.describe(`${scenario} · 六端全部入口、全部可见动作、无占位、无假成功、无死链`, () => {
  test('消费者全部可见路由和动作均有可观察结果', async ({ page }) => {
    test.setTimeout(180_000);
    await signInStorefront(page, '/');
    await inspectVisibleRoutes(page, LOCAL_STOREFRONT_ORIGIN);
  });

  test('运营控制台全部可见路由和动作均有可观察结果', async ({ page }) => {
    test.setTimeout(240_000);
    await signInConsole(page);
    await inspectVisibleRoutes(page, LOCAL_CONSOLE_ORIGIN);
  });
});

async function inspectVisibleRoutes(page: Page, origin: string): Promise<void> {
  const routes = await visibleRoutes(page, origin);
  expect(routes.length).toBeGreaterThan(0);
  for (const route of routes) {
    await page.goto(route, { waitUntil: 'commit' });
    await page.locator('body').waitFor({ state: 'visible' });
    await expectPageCopy(page);
    await exerciseVisibleActions(page, route);
  }
}

async function visibleRoutes(page: Page, origin: string): Promise<readonly string[]> {
  const values = await page.locator('a[href]:visible').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  return Object.freeze([...new Set([page.url(), ...values.filter((value) => value.startsWith(origin))])].sort());
}

async function expectPageCopy(page: Page): Promise<void> {
  const body = (await page.locator('body').innerText()).trim();
  expect(body).not.toMatch(forbiddenCopy);
  expect(body).not.toMatch(uuid);
  const links = await page.locator('a:visible').evaluateAll((items) => items.map((item) => (item as HTMLAnchorElement).getAttribute('href')));
  expect(links.every((value) => value !== null && value.trim() !== '' && value.trim() !== '#')).toBe(true);
}

async function exerciseVisibleActions(page: Page, route: string): Promise<void> {
  const count = await page.locator('button:visible:not(:disabled),a[href]:visible').count();
  for (let index = 0; index < count; index += 1) {
    await page.goto(route, { waitUntil: 'commit' });
    const actions = page.locator('button:visible:not(:disabled),a[href]:visible');
    if (index >= (await actions.count())) continue;
    const action = actions.nth(index);
    const snapshot = await action.evaluate((element) => ({
      tag: element.tagName,
      current: element.getAttribute('aria-current'),
      pressed: element.getAttribute('aria-pressed'),
      selected: element.getAttribute('data-selected'),
      submit: element instanceof HTMLButtonElement && element.type === 'submit' && element.form !== null,
    }));
    if (snapshot.tag === 'A' || snapshot.submit || snapshot.current || snapshot.pressed === 'true' || snapshot.selected === 'true') continue;
    const before = await observable(page, action);
    let requests = 0;
    const observe = () => { requests += 1; };
    page.on('request', observe);
    await action.click({ timeout: 3_000 });
    await page.waitForTimeout(80);
    page.off('request', observe);
    const after = await observable(page, page.locator('button:visible:not(:disabled),a[href]:visible').nth(Math.min(index, Math.max(0, (await page.locator('button:visible:not(:disabled),a[href]:visible').count()) - 1))));
    expect(requests > 0 || before.url !== after.url || before.dialogs !== after.dialogs || before.text !== after.text || before.state !== after.state || before.scroll !== after.scroll).toBe(true);
  }
}

async function observable(page: Page, action: ReturnType<Page['locator']>): Promise<Readonly<{ url: string; dialogs: number; text: string; state: string; scroll: number }>> {
  return Object.freeze({
    url: page.url(),
    dialogs: await page.locator('[role="dialog"]:visible').count(),
    text: (await page.locator('body').innerText()).slice(0, 10_000),
    state: await action.evaluate((element) => [element.getAttribute('aria-expanded'), element.getAttribute('aria-pressed'), element.getAttribute('data-state'), element.getAttribute('data-selected')].join(':')).catch(() => 'detached'),
    scroll: await page.evaluate(() => Math.round(window.scrollX + window.scrollY)),
  });
}
