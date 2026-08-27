import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { TARGET_SCHEMA_HEAD } from '@shop/config/server';

const root = resolve(import.meta.dirname, '../..');
const validator = resolve(root, 'scripts/release/validate.mjs');
const sha = 'a'.repeat(64);

function release() {
  return {
    schema: 'shop.release.v1', releaseId: 'release123', commit: 'b'.repeat(40), schemaHead: TARGET_SCHEMA_HEAD, contractHash: sha,
    commerce: { image: `registry.example/shop@sha256:${sha}`, artifactSha256: sha },
    sbom: { path: 'sbom.cdx.json', sha256: sha }, provenance: { path: 'stage.json', sha256: sha },
    static: { bucket: 'shop-production' },
    clients: Object.fromEntries(['auth', 'console', 'miniapp', 'store', 'storefront', 'supplier'].map((client) => [client, { path: `clients/${client}`, sha256: sha }])),
    evidence: { databaseSnapshot: 'oss://shop-evidence/snapshot', releaseApproval: sha, providerSandboxAccepted: true, stagePassed: true },
    rollback: { releaseId: 'release122', databaseSnapshot: 'oss://shop-evidence/previous', pointerSha256: sha },
  };
}

function validate(value: unknown) {
  const directory = mkdtempSync(join(tmpdir(), 'shop-release-'));
  try {
    const manifest = join(directory, 'release.json');
    writeFileSync(manifest, JSON.stringify(value));
    return spawnSync(process.execPath, ['--import', 'tsx', validator, manifest], { encoding: 'utf8' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('release validator accepts only the six signed runtime artifacts and rollback evidence', () => {
  const result = validate(release());
  assert.equal(result.status, 0, result.stderr);
});

test('release validator fails closed when external acceptance or rollback evidence is absent', () => {
  const missingSandbox = release();
  missingSandbox.evidence.providerSandboxAccepted = false;
  assert.notEqual(validate(missingSandbox).status, 0);
  const missingRollback = release();
  missingRollback.rollback.pointerSha256 = '';
  assert.notEqual(validate(missingRollback).status, 0);
});

test('deployment topology has no retired runtime and keeps migration before runtime apply', () => {
  const script = readFileSync(resolve(root, 'infrastructure/aliyun/deploy.sh'), 'utf8');
  const topology = readFileSync(resolve(root, 'infrastructure/aliyun/runtime.template.yml'), 'utf8');
  assert.ok(script.indexOf('migration.template.yml') < script.indexOf('runtime.template.yml'));
  assert.match(script, /for percentage in 5 25 50 100/);
  assert.match(script, /trap rollback ERR/);
  assert.match(script, /evidence export/);
  assert.match(script, /cutover\.mjs/);
  assert.match(topology, /replicas: 3/);
  assert.match(topology, /replicas: 2/);
  assert.doesNotMatch(`${script}\n${topology}`.toLowerCase(), /pm2|vite preview|core-read-cache|commerce-api/);
});
