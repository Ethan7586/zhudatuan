import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { artifactClientFromEnvironment, artifactDownloadClientFromEnvironment } from '../src/artifact-client-1-6.mjs';
import { createR2Client, r2ClientFromEnvironment } from '../src/r2-client-1-6.mjs';

test('artifact storage uses Cloudflare R2 by default', async () => {
  const environment = {
    CLOUDFLARE_R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
    CLOUDFLARE_R2_BUCKET: 'releases',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret',
  };
  const client = await artifactClientFromEnvironment(environment);
  const download = artifactDownloadClientFromEnvironment(client, environment);
  assert.equal(client.endpoint, 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com');
  assert.equal(download, client);
});

test('R2 client keeps the artifact contract and uses the same endpoint for downloads', async () => {
  const calls = [];
  class HeadObjectCommand { constructor(input) { this.input = input; } }
  class GetObjectCommand { constructor(input) { this.input = input; } }
  class PutObjectCommand { constructor(input) { this.input = input; } }
  const body = Buffer.from('archive');
  const sha = createHash('sha256').update(body).digest('hex');
  let existing = false;
  const client = createR2Client({ bucket: 'releases', endpoint: 'https://account.r2.cloudflarestorage.com' }, {
    HeadObjectCommand, GetObjectCommand, PutObjectCommand,
    client: {
      async send(command) {
        calls.push(command);
        if (command instanceof HeadObjectCommand) {
          if (!existing) throw { $metadata: { httpStatusCode: 404 } };
          return { ContentLength: body.byteLength, Metadata: { sha256: sha } };
        }
        if (command instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => body } };
        existing = true;
        return {};
      },
    },
    getSignedUrl: async (_client, command, options) => `https://signed.example.test/${command.input.Key}?ttl=${options.expiresIn}`,
  });
  const first = await client.putContent('artifact.tar.gz', body, 'application/gzip');
  assert.equal(first.status, 'uploaded');
  assert.deepEqual(calls.find((command) => command instanceof PutObjectCommand)?.input.Metadata, { sha256: sha });
  assert.equal((await client.putContent('artifact.tar.gz', body)).status, 'reused');
  assert.deepEqual(await client.getObject('artifact.tar.gz'), body);
  assert.equal(await client.signGet('artifact.tar.gz'), 'https://signed.example.test/artifact.tar.gz?ttl=900');
  assert.equal(artifactDownloadClientFromEnvironment(client, { ZDT_ARTIFACT_STORE: 'r2' }), client);
});

const sdkAvailable = (() => {
  try { import.meta.resolve('@aws-sdk/client-s3'); return true; } catch { return false; }
})();

test('R2 environment generates a Cloudflare S3-signed download URL without network access', { skip: !sdkAvailable }, async () => {
  const client = await r2ClientFromEnvironment({
    CLOUDFLARE_R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
    CLOUDFLARE_R2_BUCKET: 'releases',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'test-key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'test-secret',
  });
  const url = new URL(await client.signGet('project/target/release.json'));
  assert.equal(url.host, 'releases.0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com');
  assert.equal(url.pathname, '/project/target/release.json');
  assert.equal(url.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '900');
  assert.ok(url.searchParams.get('X-Amz-Signature'));
});
