import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

import { chromium } from '@playwright/test';
import { readConsoleArtifact, validateConsoleArtifactManifest } from './console-artifact.mjs';

const args = process.argv.slice(2);
const dist = option('--dist');
const publicUrl = option('--url');
const expectedCommit = option('--expected-commit');
const requireClean = args.includes('--require-clean');
if ((dist === undefined) === (publicUrl === undefined)) throw new Error('CONSOLE_VERIFICATION_TARGET_REQUIRED');

let server;
let browser;
try {
  const local = dist !== undefined;
  const artifact = local ? readConsoleArtifact(dist, { expectedCommit, requireClean }) : { manifest: await fetchManifest(publicUrl, { expectedCommit, requireClean }) };
  const baseUrl = local ? await serve(resolve(dist)) : normalizePublicUrl(publicUrl);
  const manifest = artifact.manifest;
  const expectedApiUrl = `${manifest.apiBaseUrl}/api/v1/identity/session`;
  const expectedAuthUrl = `${manifest.authBaseUrl}/login?client=console`;
  const pageErrors = [];
  let apiReached = false;

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url() === expectedApiUrl) apiReached = true;
  });

  if (local) {
    const localOrigin = new URL(baseUrl).origin;
    await page.route(`${manifest.apiBaseUrl}/**`, async (route) => {
      const request = route.request();
      const headers = {
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type,x-client-version,x-contract-version',
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-origin': localOrigin,
      };
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      await route.fulfill({ status: request.url() === expectedApiUrl ? 401 : 404, headers, contentType: 'application/json', body: JSON.stringify({ code: 'UNAUTHENTICATED' }) });
    });
    await page.route(`${manifest.authBaseUrl}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><title>Auth target reached</title><main>AUTH_TARGET_REACHED</main>',
      })
    );
  }

  await page.goto(`${baseUrl}/?release_verify=${manifest.commit}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForURL((url) => url.href === expectedAuthUrl, { timeout: 15_000 });
  if (!apiReached) throw new Error('CONSOLE_BROWSER_API_ORIGIN_NOT_REACHED');
  if (pageErrors.length > 0) throw new Error(`CONSOLE_BROWSER_PAGE_ERROR:${pageErrors.join('|')}`);
  if ((await page.locator('body').innerText()).includes('CLIENT_')) throw new Error('CONSOLE_BROWSER_CONFIG_ERROR_RENDERED');
  await verifyOwnerWorkspaceResilience(browser, baseUrl, manifest);
  console.log(`console browser verified: ${local ? resolve(dist) : baseUrl} commit=${manifest.commit} ownerWorkspace=passed`);

  async function serve(root) {
    server = createServer((request, response) => serveStatic(root, request, response));
    await new Promise((accept, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', accept);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('CONSOLE_STATIC_SERVER_ADDRESS_INVALID');
    return `http://127.0.0.1:${address.port}`;
  }
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((accept) => server.close(accept));
}

async function verifyOwnerWorkspaceResilience(browser, baseUrl, manifest) {
  const ownerScope = Object.freeze({ kind: 'platform', id: 'platform:release-owner', name: '主打团平台' });
  const expectedPaths = new Set(['/api/v1/identity/session', '/api/v1/members/me', '/api/v1/access/center']);
  const reachedPaths = new Set();
  const browserErrors = [];
  let expectedProfileFailures = 0;
  const page = await browser.newPage();
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    const expectedNetworkNoise = message.type() === 'error'
      && message.text() === 'Failed to load resource: the server responded with a status of 403 (Forbidden)';
    if (message.type() === 'error' && !expectedNetworkNoise) browserErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const path = new URL(response.url()).pathname;
    if (path === '/api/v1/members/me' && response.status() === 403) {
      expectedProfileFailures += 1;
      return;
    }
    browserErrors.push(`HTTP_${response.status()}:${path}`);
  });

  const consoleOrigin = new URL(baseUrl).origin;
  await page.route(`${manifest.apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = apiHeaders(consoleOrigin);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    reachedPaths.add(url.pathname);
    if (request.method() !== 'GET') {
      await json(route, 405, { code: 'METHOD_NOT_ALLOWED' }, headers);
      return;
    }
    if (url.pathname === '/api/v1/identity/session') {
      await json(route, 200, {
        actor: 'actor:release-owner',
        membership: 'membership:release-owner',
        scope: ownerScope,
        scopes: [ownerScope],
        accessVersion: 12,
        permissions: ['access.center.read', 'access.role.manage', 'access.scope.manage', 'member.read'],
        capabilities: ['access.center.read', 'access.roles.manage', 'access.scopes.manage', 'member.members.read'],
        assurance: { level: 2, verified: 'password' },
        csrf: 'csrf:release-owner:verification',
        target: 'console',
        syncedAt: '2026-09-01T13:00:00.000Z',
      }, headers);
      return;
    }
    if (url.pathname === '/api/v1/members/me') {
      await json(route, 403, {
        code: 'SCOPE_DENIED',
        message: 'controlled release verification profile failure',
        requestId: 'request:release-owner:profile',
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
    await json(route, 404, { code: 'RELEASE_VERIFICATION_ROUTE_UNMATCHED', path: url.pathname }, headers);
  });

  try {
    const scope = encodeURIComponent(ownerScope.id);
    await page.goto(`${baseUrl}/scopes/platform/${scope}/settings/access?release_verify=${manifest.commit}`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    await page.getByRole('heading', { level: 1, name: '会员与权限' }).waitFor({ state: 'visible', timeout: 15_000 });
    if (await page.getByRole('heading', { name: '没有权限' }).count()) {
      throw new Error('CONSOLE_OWNER_WORKSPACE_RENDERED_PERMISSION_DENIED');
    }
    await page.getByRole('button', { name: '个人中心：当前用户' }).click();
    await page.getByRole('heading', { level: 1, name: '个人信息' }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByText('个人资料暂不可用', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    const missingPaths = [...expectedPaths].filter((path) => !reachedPaths.has(path));
    if (missingPaths.length > 0) throw new Error(`CONSOLE_OWNER_WORKSPACE_API_PATH_MISSING:${missingPaths.join(',')}`);
    if (expectedProfileFailures < 1) throw new Error('CONSOLE_OWNER_WORKSPACE_PROFILE_FAILURE_NOT_OBSERVED');
    if (browserErrors.length > 0) throw new Error(`CONSOLE_OWNER_WORKSPACE_BROWSER_ERROR:${browserErrors.join('|')}`);
  } finally {
    await page.close();
  }
}

function apiHeaders(origin) {
  return {
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,x-access-version,x-client-version,x-contract-version,x-scope-id,x-scope-kind',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-origin': origin,
    'cache-control': 'no-store',
  };
}

async function json(route, status, body, headers) {
  await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
}

function option(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`CONSOLE_VERIFICATION_OPTION_VALUE_MISSING:${name}`);
  return value;
}

async function fetchManifest(baseUrl, options) {
  const target = new URL('console-build.json', `${normalizePublicUrl(baseUrl)}/`);
  target.searchParams.set('release_verify', Date.now().toString());
  const response = await fetch(target, { cache: 'no-store' });
  if (!response.ok) throw new Error(`CONSOLE_PUBLIC_MANIFEST_HTTP_${response.status}`);
  return validateConsoleArtifactManifest(await response.json(), options);
}

function normalizePublicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('CONSOLE_PUBLIC_URL_INVALID');
  }
  return url.href.replace(/\/$/, '');
}

function serveStatic(root, request, response) {
  if (!['GET', 'HEAD'].includes(request.method ?? '')) {
    response.writeHead(405).end();
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const candidate = resolve(root, `.${pathname}`);
  let file = candidate.startsWith(`${root}${sep}`) && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(root, 'index.html');
  if (relative(root, file).startsWith('..')) file = join(root, 'index.html');
  const content = readFileSync(file);
  response.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : content);
}

function contentType(file) {
  return (
    {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
    }[extname(file)] ?? 'application/octet-stream'
  );
}
