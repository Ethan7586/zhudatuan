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
  console.log(`console browser verified: ${local ? resolve(dist) : baseUrl} commit=${manifest.commit}`);

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
