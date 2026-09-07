import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

import { chromium } from '@playwright/test';
import { resolveConsoleAppConfig } from '@shop/config/sfl-console-runtime';
import { readConsoleArtifact } from '../release/console-artifact.mjs';

const args = process.argv.slice(2);
const baselineDist = requiredOption('--baseline-dist');
const candidateDist = option('--candidate-dist');
const jsonOutput = option('--json-output');
const cpuProfileOutput = option('--cpu-profile-output');
const entryPath = normalizeEntryPath(option('--entry-path') ?? '/');
const samples = integerOption('--samples', 5, 1, 20);
const profile = Object.freeze({
  latencyMs: integerOption('--latency-ms', 120, 0, 2_000),
  downloadKbps: integerOption('--download-kbps', 1_600, 1, 1_000_000),
  uploadKbps: integerOption('--upload-kbps', 750, 1, 1_000_000),
  cpuRate: integerOption('--cpu-rate', 4, 1, 20),
  apiDelayMs: integerOption('--api-delay-ms', 80, 0, 10_000),
});

const targets = [
  await target('baseline', baselineDist),
  ...(candidateDist === undefined ? [] : [await target('candidate', candidateDist)]),
];

try {
  for (let sample = 0; sample < samples; sample += 1) {
    const order = sample % 2 === 0 ? targets : [...targets].reverse();
    for (const item of order) item.runs.push(await measure(item, sample + 1));
  }

  const reports = Object.fromEntries(targets.map((item) => [item.label, summarize(item)]));
  const comparison = reports.candidate === undefined ? undefined : compare(reports.baseline, reports.candidate);
  const output = Object.freeze({
    scenario: entryPath === '/' ? 'console-owner-login-cold-start' : 'console-owner-route-cold-start',
    entryPath,
    samples,
    profile,
    reports,
    ...(comparison === undefined ? {} : { comparison }),
  });
  if (jsonOutput !== undefined) writeFileSync(resolve(jsonOutput), `${JSON.stringify(output, null, 2)}\n`);
  print(output, jsonOutput === undefined);
} finally {
  await Promise.all(targets.map(({ server }) => new Promise((accept) => server.close(accept))));
}

async function target(label, directory) {
  const dist = resolve(directory);
  const artifact = await readConsoleArtifact(dist);
  const hosted = await serve(dist);
  const runtime = resolveConsoleAppConfig(artifact.manifest, 'console.zhudatuan.com');
  return {
    label,
    dist,
    manifest: artifact.manifest,
    runtime,
    baseUrl: runtime.consoleOrigin,
    localBaseUrl: hosted.baseUrl,
    server: hosted.server,
    startupAssets: startupAssets(dist),
    runs: [],
  };
}

async function measure(target, sample) {
  const browser = await chromium.launch({ headless: true });
  try {
    return await measureInBrowser(browser, target, sample);
  } finally {
    await browser.close();
  }
}

async function measureInBrowser(browser, target, sample) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  const requests = new Map();
  const responseFailures = [];
  const requestFailures = [];
  const pageErrors = [];
  const consoleErrors = [];
  const unmatchedApi = [];

  client.on('Network.requestWillBeSent', ({ requestId, request, timestamp, type }) => {
    requests.set(requestId, { url: request.url, type, startedAt: timestamp, encodedBytes: 0, finished: false });
  });
  client.on('Network.loadingFinished', ({ requestId, encodedDataLength, timestamp }) => {
    const request = requests.get(requestId);
    if (request !== undefined) {
      request.encodedBytes = encodedDataLength;
      request.finishedAt = timestamp;
      request.finished = true;
    }
  });
  client.on('Network.loadingFailed', ({ requestId, errorText }) => {
    const request = requests.get(requestId);
    requestFailures.push(`${request?.url ?? requestId}:${errorText}`);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) responseFailures.push(`${response.status()}:${response.url()}`);
  });

  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latencyMs,
    downloadThroughput: profile.downloadKbps * 1024 / 8,
    uploadThroughput: profile.uploadKbps * 1024 / 8,
    connectionType: 'cellular4g',
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate });
  const captureCpu = cpuProfileOutput !== undefined && sample === 1;
  if (captureCpu) {
    await client.send('Profiler.enable');
    await client.send('Profiler.start');
  }
  await page.addInitScript(installObservers);
  await proxyLocalArtifact(page, target);
  await mockOwnerApi(page, target, unmatchedApi);

  try {
    const entry = new URL(entryPath, `${target.baseUrl}/`);
    entry.searchParams.set('perf_sample', String(sample));
    await page.goto(entry.href, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForFunction(() => globalThis.__consoleColdStart?.interactiveReady > 0, undefined, { timeout: 30_000 });
    const readiness = await page.evaluate(() => ({
      visibleReadyMs: globalThis.__consoleColdStart.visibleReady,
      interactiveReadyMs: globalThis.__consoleColdStart.interactiveReady,
    }));
    const criticalRequestIds = new Set(requests.keys());
    await page.waitForFunction(() => ['.cockpittrend h2', '#mallcomparisontitle', '#eventstitle', '#insightstitle']
      .every((selector) => document.querySelector(selector)?.getClientRects().length), undefined, { timeout: 10_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(100);
    const observed = await page.evaluate(() => {
      const state = globalThis.__consoleColdStart;
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
      return {
        fcpMs: typeof fcp === 'number' ? fcp : null,
        lcpMs: state.lcp,
        cls: state.cls,
        longTasks: state.longTasks,
      };
    });
    if (captureCpu) {
      const { profile: cpuProfile } = await client.send('Profiler.stop');
      writeFileSync(`${resolve(cpuProfileOutput)}.${target.label}.json`, `${JSON.stringify(cpuProfile)}\n`);
    }
    if (unmatchedApi.length > 0) throw new Error(`UNMATCHED_API:${unmatchedApi.join(',')}`);
    const errors = [...pageErrors, ...consoleErrors, ...responseFailures, ...requestFailures];
    if (errors.length > 0) throw new Error(`BROWSER_ERRORS:${errors.join('|')}`);
    if (observed.fcpMs === null || observed.lcpMs === 0) throw new Error('PAINT_METRICS_MISSING');

    const network = [...requests.entries()].filter(([, request]) => !request.url.startsWith('data:'));
    const networkStart = Math.min(...network.map(([, request]) => request.startedAt));
    return Object.freeze({
      sample,
      ...readiness,
      ...observed,
      requestCount: network.length,
      transferBytes: network.reduce((total, [, request]) => total + request.encodedBytes, 0),
      criticalTransferBytes: network
        .filter(([requestId]) => criticalRequestIds.has(requestId))
        .reduce((total, [, request]) => total + request.encodedBytes, 0),
      criticalAssets: network
        .filter(([requestId, request]) => criticalRequestIds.has(requestId) && ['Document', 'Script', 'Stylesheet'].includes(request.type))
        .map(([, request]) => assetName(request.url, target.baseUrl))
        .filter((value) => value !== undefined)
        .sort(),
      requestTimeline: network.map(([, request]) => ({
        asset: new URL(request.url).origin === new URL(target.baseUrl).origin
          ? new URL(request.url).pathname
          : `${new URL(request.url).origin}${new URL(request.url).pathname}`,
        type: request.type,
        startMs: round((request.startedAt - networkStart) * 1_000),
        durationMs: request.finishedAt === undefined ? null : round((request.finishedAt - request.startedAt) * 1_000),
        encodedBytes: round(request.encodedBytes),
      })),
      pageErrors: pageErrors.length,
      consoleErrors: consoleErrors.length,
    });
  } finally {
    await context.close();
  }
}

async function proxyLocalArtifact(page, target) {
  await page.route(`${target.baseUrl}/**`, async (route) => {
    const requested = new URL(route.request().url());
    const localUrl = new URL(`${requested.pathname}${requested.search}`, `${target.localBaseUrl}/`);
    const response = await route.fetch({ url: localUrl.href });
    await route.fulfill({ response });
  });
}

function normalizeEntryPath(value) {
  const url = new URL(value, 'https://console.zhudatuan.com/');
  if (url.origin !== 'https://console.zhudatuan.com') throw new Error('ENTRY_PATH_MUST_BE_RELATIVE');
  return `${url.pathname}${url.search}`;
}

function installObservers() {
  const state = { visibleReady: 0, interactiveReady: 0, lcp: 0, cls: 0, longTasks: [] };
  globalThis.__consoleColdStart = state;
  let framePending = false;
  const readinessObserver = new MutationObserver(() => {
    if (state.interactiveReady > 0 || framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        framePending = false;
        const heading = document.querySelector('#cockpittitle');
        const metrics = [...document.querySelectorAll('.cockpitmetricband article')];
        const visible = heading?.textContent?.trim() === '经营驾驶舱'
          && metrics.length === 4
          && metrics.every((metric) => metric.querySelector('strong')?.textContent?.trim());
        if (visible && state.visibleReady === 0) state.visibleReady = performance.now();
        const navigation = document.querySelector('.sidebarnavigation button[aria-current="page"]');
        const period = document.querySelector('#consoleperiod');
        const interactive = navigation instanceof HTMLButtonElement && !navigation.disabled
          && navigation.getAttribute('aria-disabled') !== 'true' && period instanceof HTMLSelectElement && !period.disabled;
        if (visible && interactive) {
          state.interactiveReady = performance.now();
          readinessObserver.disconnect();
        }
      });
    });
  });
  readinessObserver.observe(document, { attributes: true, childList: true, subtree: true });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) state.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.longTasks.push({ startMs: entry.startTime, durationMs: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}

}

async function mockOwnerApi(page, target, unmatchedApi) {
  const ownerScope = Object.freeze({ kind: 'platform', id: 'platform:perf-owner', name: '主打团平台' });
  const origin = new URL(target.baseUrl).origin;
  await page.route(`${target.runtime.apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = apiHeaders(origin);
    if (profile.apiDelayMs > 0) await new Promise((accept) => setTimeout(accept, profile.apiDelayMs));
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (request.method() !== 'GET') {
      await json(route, 405, { code: 'METHOD_NOT_ALLOWED' }, headers);
      return;
    }
    if (url.pathname === '/api/v1/identity/session') {
      await json(route, 200, {
        actor: 'actor:perf-owner',
        membership: 'membership:perf-owner',
        scope: ownerScope,
        scopes: [ownerScope],
        accessVersion: 12,
        permissions: ['organization.layer.read', 'reporting.dashboard.read'],
        capabilities: ['organization.layers.read', 'reporting.dashboard.read'],
        assurance: { level: 2, verified: 'password' },
        csrf: 'csrf:performance:owner:verification',
        target: 'console',
        syncedAt: '2026-09-01T13:00:00.000Z',
      }, headers);
      return;
    }
    if (url.pathname === '/api/v1/organizations/layers') {
      await json(route, 200, { items: [], count: 0 }, headers);
      return;
    }
    if (url.pathname === '/api/v1/members/me') {
      await json(route, 200, { display_name: 'Ethan', employee_no: null }, headers);
      return;
    }
    if (url.pathname === '/api/v1/reports/dashboard') {
      await json(route, 200, {
        items: [],
        count: 0,
        summary: {
          catalogCount: 5008,
          availableStock: 80,
          orderCount: 7,
          afterSaleCount: 1,
          sales: {
            asOf: '2026-09-01T13:00:00.000Z',
            cumulativeSalesCents: 31500,
            paidOrderCount: 7,
            averageOrderValueCents: 4500,
            periodSalesCents: 31500,
            periodPaidOrderCount: 7,
            refundedCents: 0,
            activeProductCount: 5008,
            soldProductCount: 7,
            unsoldActiveProductCount: 5001,
            trend: [{ date: '2026-09-01', salesCents: 31500, orderCount: 7 }],
            categories: [],
            topProducts: [],
            period: { from: '2026.08.03', to: '2026.09.01' },
            conclusion: '本期经营保持增长，需要关注。',
            deltas: { netSalesRatio: 0.128, paidOrdersRatio: 0.086, averageOrderRatio: 0.039, refundRate: 0.028, refundRateDeltaPoints: 0.006 },
            malls: [],
            events: [],
            insights: [],
          },
        },
      }, headers);
      return;
    }
    if (url.pathname === '/api/v1/access/center') {
      await json(route, 200, {
        items: [],
        count: 0,
        roles: [{
          id: 'role-platform-owner-v2',
          name: '平台 Owner',
          status: 'active',
          version: 12,
          permissions: ['access.role.manage'],
          member_count: 1,
          governance: true,
          editable: false,
          members: [],
          scopes: [],
        }],
      }, headers);
      return;
    }
    if (url.pathname === '/api/v1/members') {
      await json(route, 200, { items: [], count: 0 }, headers);
      return;
    }
    unmatchedApi.push(url.pathname);
    await json(route, 404, { code: 'PERFORMANCE_ROUTE_UNMATCHED', path: url.pathname }, headers);
  });
}

function summarize(target) {
  const values = (key) => target.runs.map((run) => run[key]);
  const longTasks = target.runs.flatMap((run) => run.longTasks.map(({ durationMs }) => durationMs));
  const criticalAssets = [...new Set(target.runs.flatMap((run) => run.criticalAssets))].sort();
  return Object.freeze({
    dist: target.dist,
    commit: target.manifest.source_sha,
    metrics: {
      visibleReadyMs: distribution(values('visibleReadyMs')),
      interactiveReadyMs: distribution(values('interactiveReadyMs')),
      fcpMs: distribution(values('fcpMs')),
      lcpMs: distribution(values('lcpMs')),
      cls: distribution(values('cls')),
      longTaskMs: distribution(longTasks.length === 0 ? [0] : longTasks),
      requestCount: distribution(values('requestCount')),
      transferKb: distribution(values('transferBytes').map((value) => value / 1024)),
      criticalTransferKb: distribution(values('criticalTransferBytes').map((value) => value / 1024)),
    },
    errors: {
      page: values('pageErrors').reduce(sum, 0),
      console: values('consoleErrors').reduce(sum, 0),
    },
    dependencyClosure: {
      startupAssets: target.startupAssets,
      criticalAssets,
    },
    runs: target.runs,
  });
}

function compare(baseline, candidate) {
  const noErrors = candidate.errors.page === 0 && candidate.errors.console === 0;
  const budget = {
    visibleReadyP50: candidate.metrics.visibleReadyMs.p50 <= 1_500,
    visibleReadyP95: candidate.metrics.visibleReadyMs.p95 <= 1_800,
    interactiveReadyP50: candidate.metrics.interactiveReadyMs.p50 <= 1_800,
    interactiveReadyP95: candidate.metrics.interactiveReadyMs.p95 <= 2_200,
    fcpP50: candidate.metrics.fcpMs.p50 <= 650,
    lcpP50: candidate.metrics.lcpMs.p50 <= 1_600,
    clsZero: candidate.metrics.cls.max === 0,
    longTaskP95: candidate.metrics.longTaskMs.p95 <= 90,
    pageAndConsoleErrorsZero: noErrors,
    requestCountNotIncreased: candidate.metrics.requestCount.max <= baseline.metrics.requestCount.max,
    transferNotIncreased: candidate.metrics.transferKb.max <= baseline.metrics.transferKb.max,
    criticalTransferAtMost180Kb: candidate.metrics.criticalTransferKb.p95 <= 180,
  };
  return Object.freeze({
    improvementPct: {
      visibleReadyP50: improvement(baseline.metrics.visibleReadyMs.p50, candidate.metrics.visibleReadyMs.p50),
      visibleReadyP95: improvement(baseline.metrics.visibleReadyMs.p95, candidate.metrics.visibleReadyMs.p95),
      interactiveReadyP50: improvement(baseline.metrics.interactiveReadyMs.p50, candidate.metrics.interactiveReadyMs.p50),
      interactiveReadyP95: improvement(baseline.metrics.interactiveReadyMs.p95, candidate.metrics.interactiveReadyMs.p95),
      fcpP50: improvement(baseline.metrics.fcpMs.p50, candidate.metrics.fcpMs.p50),
      fcpP95: improvement(baseline.metrics.fcpMs.p95, candidate.metrics.fcpMs.p95),
      lcpP50: improvement(baseline.metrics.lcpMs.p50, candidate.metrics.lcpMs.p50),
      lcpP95: improvement(baseline.metrics.lcpMs.p95, candidate.metrics.lcpMs.p95),
    },
    budget: {
      ...budget,
      accepted: Object.values(budget).every(Boolean),
    },
  });
}

function startupAssets(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const assets = [];
  for (const match of html.matchAll(/<(script|link)\b([^>]*)>/g)) {
    const [, element, source] = match;
    const attributes = Object.fromEntries([...source.matchAll(/([a-z-]+)="([^"]*)"/g)].map((item) => [item[1], item[2]]));
    const kind = element === 'script' && attributes.type === 'module'
      ? 'module'
      : element === 'link' && ['modulepreload', 'stylesheet'].includes(attributes.rel)
        ? attributes.rel
        : element === 'link' && attributes.rel === 'preload' && attributes.as === 'style'
          ? 'style-preload'
        : undefined;
    const url = element === 'script' ? attributes.src : attributes.href;
    if (kind === undefined || url === undefined || !url.startsWith('/assets/')) continue;
    const file = join(dist, url.slice(1));
    const content = readFileSync(file);
    assets.push({ path: url, kind, rawBytes: content.byteLength, gzipBytes: gzipSync(content).byteLength });
  }
  return assets;
}

function distribution(input) {
  const values = [...input].sort((left, right) => left - right);
  return Object.freeze({ p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: round(values.at(-1) ?? 0) });
}

function percentile(values, quantile) {
  if (values.length === 0) return 0;
  const position = (values.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const value = lower === upper
    ? values[lower]
    : values[lower] + (values[upper] - values[lower]) * (position - lower);
  return round(value);
}

function improvement(baseline, candidate) {
  return baseline === 0 ? 0 : round((baseline - candidate) / baseline * 100);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function sum(total, value) {
  return total + value;
}

function assetName(value, baseUrl) {
  const url = new URL(value);
  if (url.origin !== new URL(baseUrl).origin) return undefined;
  return url.pathname;
}

function apiHeaders(origin) {
  return {
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'accept,content-type,x-access-version,x-client-version,x-contract-version,x-scope-hint,x-scope-id,x-scope-kind,x-trace-id',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-origin': origin,
    'cache-control': 'no-store',
    'timing-allow-origin': '*',
  };
}

async function json(route, status, body, headers) {
  await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
}

async function serve(root) {
  const server = createServer((request, response) => serveStatic(root, request, response));
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('CONSOLE_PERF_SERVER_ADDRESS_INVALID');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function serveStatic(root, request, response) {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://console.local').pathname);
  const candidate = resolve(root, `.${pathname}`);
  let file = candidate.startsWith(`${root}${sep}`) && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(root, 'index.html');
  if (relative(root, file).startsWith('..')) file = join(root, 'index.html');
  const content = readFileSync(file);
  const type = contentType(file);
  const compressed = /^(text\/|application\/(javascript|json))/.test(type)
    && request.headers['accept-encoding']?.includes('gzip');
  const body = compressed ? gzipSync(content) : content;
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': type,
    'content-length': body.byteLength,
    ...(compressed ? { 'content-encoding': 'gzip', vary: 'accept-encoding' } : {}),
  });
  response.end(body);
}

function contentType(file) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
  }[extname(file)] ?? 'application/octet-stream';
}

function print(output, includeJson) {
  console.log(`console cold-start: samples=${output.samples} latency=${profile.latencyMs}ms down=${profile.downloadKbps}kbps cpu=${profile.cpuRate}x apiDelay=${profile.apiDelayMs}ms`);
  for (const [label, report] of Object.entries(output.reports)) {
    console.log(`${label}: visible=${format(report.metrics.visibleReadyMs)} interactive=${format(report.metrics.interactiveReadyMs)} FCP=${format(report.metrics.fcpMs)} LCP=${format(report.metrics.lcpMs)} CLS.max=${report.metrics.cls.max} long-task.p95=${report.metrics.longTaskMs.p95}ms requests.p50=${report.metrics.requestCount.p50} transfer.p50=${report.metrics.transferKb.p50}KB critical-transfer.p95=${report.metrics.criticalTransferKb.p95}KB errors=${report.errors.page + report.errors.console}`);
    console.log(`${label} startup closure: ${report.dependencyClosure.startupAssets.map(({ path }) => path).join(',')}`);
  }
  if (output.comparison !== undefined) {
    console.log(`improvement: visible P50=${output.comparison.improvementPct.visibleReadyP50}% interactive P50=${output.comparison.improvementPct.interactiveReadyP50}% accepted=${output.comparison.budget.accepted}`);
  }
  if (includeJson) console.log(JSON.stringify(output, null, 2));
  else console.log(`json: ${resolve(jsonOutput)}`);
}

function format(value) {
  return `P50 ${value.p50}ms / P95 ${value.p95}ms`;
}

function requiredOption(name) {
  const value = option(name);
  if (value === undefined) throw new Error(`CONSOLE_PERF_OPTION_REQUIRED:${name}`);
  return value;
}

function option(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`CONSOLE_PERF_OPTION_VALUE_MISSING:${name}`);
  return value;
}

function integerOption(name, fallback, minimum, maximum) {
  const source = option(name);
  if (source === undefined) return fallback;
  const value = Number(source);
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`CONSOLE_PERF_OPTION_INVALID:${name}`);
  return value;
}
