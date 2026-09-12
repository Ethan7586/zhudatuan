import { expect, test, type Page } from '@playwright/test';

const mall = Object.freeze({ kind: 'mall', id: 'mall-hbbtzn', tenant: 'tenant-zhudatuan', name: '宏泰商城' });
const session = Object.freeze({
  actor: 'principal:member-perf-owner', membership: 'membership:member-perf-owner', scope: mall, scopes: [mall],
  accessVersion: 12, permissions: [], capabilities: ['member.members.read'], assurance: { level: 2 },
  csrf: 'csrf:member-performance-owner', target: 'console', syncedAt: '2026-09-13T08:00:00.000Z',
});

test('商城会员缓存命中连续 10 次在首帧反馈并后台刷新', async ({ page }) => {
  let memberRequests = 0;
  const api = await memberApi(page, async () => {
    memberRequests += 1;
    await delay(memberRequests === 1 ? 80 : 120);
    await page.evaluate((phase) => {
      document.documentElement.dataset[phase] = String(performance.now());
    }, memberRequests === 1 ? 'memberPrefetchReady' : 'memberRefreshAt');
    return memberPage();
  });
  await page.goto('/scopes/mall/mall-hbbtzn/settings/profile');
  await expect(page.locator('button[data-module="access"]')).toBeVisible();
  await expect.poll(() => page.locator('html').getAttribute('data-member-prefetch-ready')).not.toBeNull();

  const runs: Timing[] = [];
  for (let index = 1; index <= 10; index += 1) {
    await installTimingObserver(page);
    await page.locator('button[data-module="access"]').click();
    await expect(page.getByRole('row', { name: '查看管理员 宏泰会员 01' })).toBeVisible();
    await expect.poll(() => page.locator('html').getAttribute('data-member-refresh-at')).not.toBeNull();
    const timing = await readTiming(page, index);
    runs.push(timing);
    console.log(`MEMBER_WARM_RUN ${JSON.stringify(timing)}`);
    await page.getByRole('button', { name: /^个人中心：/ }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
  }

  expect(runs.every(({ feedbackMs }) => feedbackMs <= 100)).toBe(true);
  expect(runs.every(({ listMs }) => listMs <= 300)).toBe(true);
  expect(memberRequests).toBe(11);
  expect(api.unmatched).toEqual([]);
});

test('商城会员无缓存冷请求单列真实等待时间', async ({ page }) => {
  await page.addInitScript(() => {
    window.requestIdleCallback = (callback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 5_000);
    window.cancelIdleCallback = (handle) => window.clearTimeout(handle);
  });
  let memberRequests = 0;
  const api = await memberApi(page, async () => {
    memberRequests += 1;
    await delay(500);
    await page.evaluate(() => {
      document.documentElement.dataset.memberRefreshAt = String(performance.now());
    });
    return memberPage();
  });
  await page.goto('/scopes/mall/mall-hbbtzn/settings/profile');
  await expect(page.locator('button[data-module="access"]')).toBeVisible();
  await installTimingObserver(page);
  await page.locator('button[data-module="access"]').click();
  await expect(page.getByRole('row', { name: '查看管理员 宏泰会员 01' })).toBeVisible();
  const timing = await readTiming(page, 0);
  console.log(`MEMBER_COLD_RUN ${JSON.stringify(timing)}`);

  expect(timing.feedbackMs).toBeLessThanOrEqual(100);
  expect(timing.listMs).toBeLessThanOrEqual(800);
  expect(memberRequests).toBe(1);
  expect(api.unmatched).toEqual([]);
});

async function memberApi(page: Page, members: () => Promise<unknown>): Promise<{ readonly unmatched: string[] }> {
  const unmatched: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      unmatched.push(`${request.method()} ${path}`);
      await route.fulfill({ status: 501, json: { code: 'MEMBER_PERF_METHOD_UNMATCHED' } });
      return;
    }
    if (path === '/api/v1/identity/session') {
      await route.fulfill({ status: 200, json: session });
      return;
    }
    if (path === '/api/v1/members/me') {
      await route.fulfill({ status: 200, json: { display_name: 'Ethan', employee_no: null } });
      return;
    }
    if (path === '/api/v1/members') {
      await route.fulfill({ status: 200, json: await members() });
      return;
    }
    unmatched.push(`GET ${path}`);
    await route.fulfill({ status: 501, json: { code: 'MEMBER_PERF_PATH_UNMATCHED' } });
  });
  return { unmatched };
}

async function installTimingObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = document.documentElement;
    delete root.dataset.memberClickAt;
    delete root.dataset.memberFeedbackAt;
    delete root.dataset.memberListAt;
    delete root.dataset.memberRefreshAt;
    const button = document.querySelector<HTMLButtonElement>('button[data-module="access"]');
    if (button === null) throw new Error('MEMBER_NAVIGATION_MISSING');
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="查看管理员 宏泰会员 01"]') !== null && root.dataset.memberListAt === undefined) {
        root.dataset.memberListAt = String(performance.now());
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    button.addEventListener('click', () => {
      root.dataset.memberClickAt = String(performance.now());
      const captureFeedback = () => {
        if (location.pathname.endsWith('/settings/members') || document.querySelector('.scopebar [role="status"]') !== null) {
          root.dataset.memberFeedbackAt = String(performance.now());
          return;
        }
        requestAnimationFrame(captureFeedback);
      };
      requestAnimationFrame(captureFeedback);
    }, { once: true });
  });
}

async function readTiming(page: Page, run: number): Promise<Timing> {
  return page.locator('html').evaluate((root, sequence) => {
    const click = Number(root.dataset.memberClickAt);
    const ms = (value: number) => Math.round(value * 10) / 10;
    return {
      run: sequence,
      feedbackMs: ms(Number(root.dataset.memberFeedbackAt) - click),
      listMs: ms(Number(root.dataset.memberListAt) - click),
      refreshMs: ms(Number(root.dataset.memberRefreshAt) - click),
    };
  }, run);
}

function memberPage() {
  return {
    items: Array.from({ length: 12 }, (_, index) => ({
      id: `member:${index + 1}`, display_name: `宏泰会员 ${String(index + 1).padStart(2, '0')}`, status: 'active',
      membership_id: `membership:${index + 1}`, employee_no: null, membership_status: 'active', access_version: 1,
      joined_at: null, principal_id: `principal:${index + 1}`, principal_version: 1, client: 'operator',
      login_identity_bound: true, reset_allowed: false, reset_block_reason: null,
    })),
    count: 12,
  };
}

interface Timing { readonly run: number; readonly feedbackMs: number; readonly listMs: number; readonly refreshMs: number }
function delay(milliseconds: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
