import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { automaticClosureIncludes, evaluateDeliveryStatus, parseMergeTreeConflictFiles } from '../src/delivery-status.mjs';

const success = Object.freeze({ databaseId: 3, status: 'completed', conclusion: 'success', url: 'https://example.test/3' });
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('reports exact conflict files before a commit reaches the mainline', () => {
  const result = evaluateDeliveryStatus({ localCommit: true, remoteCommit: true, inMainline: false, channelConfigured: true,
    conflictFiles: ['ProductCatalogRoute.tsx', 'ProductQuery.ts'], prepareRuns: [], sealRuns: [] });
  assert.equal(result.code, 'MERGE_CONFLICT');
  assert.deepEqual(result.states, { committed: true, inMainline: false, sealed: false, deployable: false });
});

test('reports a local-only conflict instead of hiding it behind remote availability', () => {
  const result = evaluateDeliveryStatus({ localCommit: true, remoteCommit: false, inMainline: false, channelConfigured: true,
    conflictFiles: ['ProductSelectionRoute.tsx'], prepareRuns: [], sealRuns: [] });
  assert.equal(result.code, 'MERGE_CONFLICT');
  assert.equal(result.remoteCommit, false);
});

test('distinguishes mainline, preparation and sealing without inventing a gate', () => {
  assert.equal(evaluateDeliveryStatus({ localCommit: true, remoteCommit: true, inMainline: true, channelConfigured: true }).code, 'IN_MAINLINE');
  assert.equal(evaluateDeliveryStatus({ localCommit: true, remoteCommit: true, inMainline: true, channelConfigured: true,
    prepareRuns: [{ status: 'in_progress' }] }).code, 'PREPARING');
  assert.equal(evaluateDeliveryStatus({ localCommit: true, remoteCommit: true, inMainline: true, channelConfigured: true,
    prepareRuns: [success] }).code, 'AWAITING_SEAL');
});

test('only reports deployable when mainline, OSS Seal authority and a physical channel agree', () => {
  const sealAuthority = { status: 'SEALED', sealKey: `sha256:${'a'.repeat(64)}`, object: 'final-seal.json',
    artifactDigest: `sha256:${'b'.repeat(64)}`, controlPlaneSha: 'c'.repeat(40), updatedAt: '2026-09-16T00:00:00Z' };
  const ready = evaluateDeliveryStatus({ localCommit: true, remoteCommit: true, inMainline: true, channelConfigured: true,
    prepareRuns: [success], sealRuns: [success], sealAuthority });
  assert.equal(ready.code, 'DEPLOYABLE');
  assert.deepEqual(ready.states, { committed: true, inMainline: true, sealed: true, deployable: true });

  const missingChannel = evaluateDeliveryStatus({ localCommit: true, remoteCommit: true, inMainline: true, channelConfigured: false,
    prepareRuns: [success], sealRuns: [success], sealAuthority });
  assert.equal(missingChannel.code, 'CHANNEL_MISSING');
  assert.equal(missingChannel.states.deployable, false);
});

test('parses only conflicted paths from git merge-tree output', () => {
  const output = `0123456789012345678901234567890123456789\nProductCatalogRoute.tsx\nProductQuery.ts\n\nAuto-merging ProductCatalogRoute.tsx\nCONFLICT (content): Merge conflict`;
  assert.deepEqual(parseMergeTreeConflictFiles(output), ['ProductCatalogRoute.tsx', 'ProductQuery.ts']);
});

test('matches only the exact physical placement in an automatic closure', () => {
  const closure = {
    schemaVersion: 'zdt-automatic-artifact-closure/v1',
    sourceSha: 'a'.repeat(40),
    waves: { migrations: [], runtimes: [{ target: 'support-api', node: 'zhudatuan-l0' }], frontends: [] },
  };
  assert.equal(automaticClosureIncludes(closure, { sourceSha: 'a'.repeat(40), target: 'support-api', node: 'zhudatuan-l0' }), true);
  assert.equal(automaticClosureIncludes(closure, { sourceSha: 'a'.repeat(40), target: 'support-api', node: 'hbbtzn-l1' }), false);
  assert.equal(automaticClosureIncludes(closure, { sourceSha: 'b'.repeat(40), target: 'support-api', node: 'zhudatuan-l0' }), false);
});

test('the system dispatcher exposes read-only status through the latest control plane', async () => {
  const dispatcher = await readFile(join(projectRoot, '02_platform_pingtai/infrastructure/github-actions-runner/zdt-delivery'), 'utf8');
  assert.match(dispatcher, /deploy-source/);
  assert.match(dispatcher, /git -C "\$REPOSITORY_ROOT" fetch origin zdt-next --quiet/);
  assert.match(dispatcher, /status\) bash scripts\/release-status\.sh/);
  assert.match(dispatcher, /delivery-dispatch\.sh deploy-source/);
});

test('status reads authority directly and treats Actions as auxiliary only', async () => {
  const status = await readFile(join(projectRoot, 'scripts/release-status.mjs'), 'utf8');
  assert.match(status, /findSealLifecycleState/);
  assert.match(status, /createReleaseWriterLeaseStore/);
  assert.match(status, /'status'.*'--project'/s);
  assert.doesNotMatch(status, /workflow run|putImmutable|WriterLease.*acquire/);
});
