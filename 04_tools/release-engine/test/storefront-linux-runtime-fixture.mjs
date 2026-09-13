#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import http from 'node:http';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const distRoot = resolve(process.env.STOREFRONT_DIST ?? 'dist');
const port = Number.parseInt(process.env.STOREFRONT_PORT ?? '4410', 10);
const hostHeader = process.env.STOREFRONT_HOST_HEADER ?? 'hbbtzn.com';
const startedAt = performance.now();
let output = '';
const server = spawn(process.execPath, [join(distRoot, 'start.mjs')], {
  cwd: distRoot,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    APP_ENV: 'production',
    AUTH_MODE: 'membership',
    STOREFRONT_HOST: '127.0.0.1',
    STOREFRONT_PORT: String(port),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (chunk) => {
  output = `${output}${chunk}`.slice(-4_000);
});
server.stderr.on('data', (chunk) => {
  output = `${output}${chunk}`.slice(-4_000);
});

try {
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  assert.equal(process.version, 'v22.22.0');
  assert.equal(existsSync(join(distRoot, 'node_modules')), false);
  const home = await waitUntilReady('/');
  const readyMs = Math.round(performance.now() - startedAt);
  const h5 = await request('/h5');
  const dynamic = await request('/product-demo');
  const assetName = (await readdir(join(distRoot, 'client', 'assets'))).filter((name) => name.endsWith('.css')).sort()[0];
  assert.ok(assetName);
  const asset = await request(`/assets/${assetName}`);
  assert.equal(home.status, 200);
  assert.equal(h5.status, 200);
  assert.equal(dynamic.status, 200);
  assert.equal(asset.status, 200);
  assert.match(asset.headers['cache-control'] ?? '', /immutable/);
  assert.match(asset.headers.etag ?? '', /^W\/"[A-Za-z0-9_-]+"$/);
  const cached = await request(`/assets/${assetName}`, { 'if-none-match': asset.headers.etag });
  assert.equal(cached.status, 304);
  assert.equal(cached.bytes, 0);
  const runtime = JSON.parse(await readFile(join(distRoot, 'production-runtime.json'), 'utf8'));
  assert.equal(runtime.schema, 'storefront.production-runtime.v1');
  assert.deepEqual(runtime.bundledPackages, ['vinext']);
  assert.ok(runtime.externalImports.every((path) => path.startsWith('node:')));
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        readyMs,
        runtime,
        routes: { home: summary(home), h5: summary(h5), dynamic: summary(dynamic) },
        staticAsset: { name: basename(assetName), miss: summary(asset), hit: summary(cached), cacheControl: asset.headers['cache-control'], etag: asset.headers.etag },
        nodeModulesPresent: false,
      },
      null,
      2
    )}\n`
  );
} finally {
  server.kill('SIGTERM');
  await Promise.race([new Promise((resolveExit) => server.once('exit', resolveExit)), delay(2_000)]);
}

function summary(response) {
  return { status: response.status, contentType: response.contentType, bytes: response.bytes };
}

async function waitUntilReady(path) {
  let lastError;
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`STOREFRONT_EXITED:${server.exitCode}:${output}`);
    try {
      const response = await request(path);
      if (response.status === 200) return response;
      lastError = new Error(`HTTP_${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw lastError ?? new Error('STOREFRONT_NOT_READY');
}

function request(path, headers = {}) {
  return new Promise((resolveRequest, rejectRequest) => {
    const requestHandle = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path,
        headers: {
          host: hostHeader,
          'x-forwarded-host': hostHeader,
          'x-forwarded-proto': 'https',
          ...headers,
        },
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () =>
          resolveRequest({
            path,
            status: response.statusCode,
            contentType: response.headers['content-type'] ?? null,
            headers: response.headers,
            bytes: Buffer.concat(chunks).length,
          })
        );
      }
    );
    requestHandle.on('error', rejectRequest);
  });
}
