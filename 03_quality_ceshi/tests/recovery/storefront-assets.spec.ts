import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { mergeStorefrontAssetPool, STOREFRONT_ASSET_CACHE_SECONDS } from '../../../04_tools/scripts/release/storefront-assets.mjs';

test('old and new storefront pages keep loading each other content-hash assets after cutover and rollback', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'storefront-assets-'));
  try {
    const pool = join(temporary, 'pool');
    const releaseA = join(temporary, 'release-a', 'dist', 'client', 'assets');
    const releaseB = join(temporary, 'release-b', 'dist', 'client', 'assets');
    await mkdir(releaseA, { recursive: true });
    await mkdir(releaseB, { recursive: true });
    await writeFile(join(releaseA, 'PaymentResultPage-A1111111.js'), 'export const release = "A";');
    await writeFile(join(releaseB, 'PaymentResultPage-B2222222.js'), 'export const release = "B";');

    await mergeStorefrontAssetPool({ poolRoot: pool, assetRoots: [releaseA] });
    const result = await mergeStorefrontAssetPool({ poolRoot: pool, assetRoots: [releaseA, releaseB] });
    assert.equal(result.assetCount, 2);
    assert.equal(result.releaseAssetRoots, 2);
    assert.equal(result.cacheSeconds, STOREFRONT_ASSET_CACHE_SECONDS);

    let current = releaseA;
    const server = createServer(async (request, response) => {
      if (request.url === '/') {
        response.writeHead(200, { 'cache-control': 'no-store, must-revalidate', 'content-type': 'text/html' });
        response.end('<!doctype html><script src="/assets/PaymentResultPage-A1111111.js"></script>');
        return;
      }
      const name = request.url?.replace(/^\/assets\//u, '') ?? '';
      try {
        const body = await readFile(join(current, name));
        response.writeHead(200, { 'cache-control': `public, max-age=${STOREFRONT_ASSET_CACHE_SECONDS}, immutable` });
        response.end(body);
      } catch {
        response.writeHead(404);
        response.end('Not Found');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      const origin = `http://127.0.0.1:${address.port}`;

      current = releaseB;
      const oldAsset = await fetch(`${origin}/assets/PaymentResultPage-A1111111.js`);
      assert.equal(await oldAsset.text(), 'export const release = "A";');
      assert.equal(oldAsset.status, 200);
      assert.equal(oldAsset.headers.get('cache-control'), `public, max-age=${STOREFRONT_ASSET_CACHE_SECONDS}, immutable`);
      assert.equal((await fetch(`${origin}/assets/PaymentResultPage-B2222222.js`)).status, 200);
      assert.doesNotMatch((await fetch(origin)).headers.get('cache-control') ?? '', /immutable/u);

      current = releaseA;
      assert.equal(await (await fetch(`${origin}/assets/PaymentResultPage-B2222222.js`)).text(), 'export const release = "B";');
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }

    const manifest = JSON.parse(await readFile(join(pool, 'manifest.json'), 'utf8'));
    const digest = manifest.assets['PaymentResultPage-A1111111.js'];
    const object = join(pool, 'objects', digest.slice(0, 2), digest);
    assert.equal((await stat(join(releaseA, 'PaymentResultPage-A1111111.js'))).ino, (await stat(object)).ino);
    assert.equal((await stat(join(releaseB, 'PaymentResultPage-A1111111.js'))).ino, (await stat(object)).ino);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test('a content-hash filename collision fails instead of replacing an earlier asset', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'storefront-asset-collision-'));
  try {
    const pool = join(temporary, 'pool');
    const releaseA = join(temporary, 'a');
    const releaseB = join(temporary, 'b');
    await mkdir(releaseA);
    await mkdir(releaseB);
    await writeFile(join(releaseA, 'shared-HASH.js'), 'first');
    await writeFile(join(releaseB, 'shared-HASH.js'), 'second');
    await mergeStorefrontAssetPool({ poolRoot: pool, assetRoots: [releaseA] });
    await assert.rejects(
      mergeStorefrontAssetPool({ poolRoot: pool, assetRoots: [releaseA, releaseB] }),
      /STOREFRONT_ASSET_NAME_COLLISION:shared-HASH\.js/u,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
