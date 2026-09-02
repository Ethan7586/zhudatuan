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
    schema: 'shop.release.v1',
    releaseId: 'release123',
    commit: 'b'.repeat(40),
    schemaHead: TARGET_SCHEMA_HEAD,
    contractHash: sha,
    commerce: { image: `registry.example/shop@sha256:${sha}`, artifactSha256: sha },
    facts: {
      sourceTreeHash: sha,
      contractHash: sha,
      operationHash: sha,
      eventHash: sha,
      jobHash: sha,
      jobCount: 33,
      requirementHash: sha,
      migrationHead: TARGET_SCHEMA_HEAD,
      migrationHash: sha,
      ownershipHash: sha,
      extensionHash: sha,
      runtimeConfigHash: sha,
      imageHash: sha,
      sbomHash: sha,
      provenanceHash: sha,
    },
    sbom: { path: 'sbom.cdx.json', sha256: sha },
    buildProvenance: { path: 'provenance.intoto.jsonl', sha256: sha },
    provenance: { path: 'stage.json', sha256: sha },
    static: { bucket: 'shop-production' },
    clients: Object.fromEntries(['auth', 'console', 'storefront'].map((client) => [client, { path: `clients/${client}`, sha256: sha }])),
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

test('release validator accepts only the three canonical clients and complete signed facts', () => {
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
  const script = readFileSync(resolve(root, 'infrastructure/cloud/Deploy.sh'), 'utf8');
  const topology = readFileSync(resolve(root, 'infrastructure/container/Runtime.yml'), 'utf8');
  assert.ok(script.indexOf('Migration.yml') < script.indexOf('Runtime.yml'));
  assert.match(script, /for percentage in 1 10 50 100/);
  assert.match(script, /trap rollback ERR/);
  assert.match(script, /evidence export/);
  assert.match(script, /cutover\.mjs/);
  assert.match(topology, /replicas: 3/);
  assert.match(topology, /replicas: 2/);
  assert.doesNotMatch(`${script}\n${topology}`.toLowerCase(), /pm2|vite preview|core-read-cache|commerce-api/);
});

test('API, jobs and provider survive one pod and one availability-zone loss', () => {
  const runtime = readFileSync(resolve(root, 'infrastructure/container/Runtime.yml'), 'utf8');
  const provider = readFileSync(resolve(root, 'infrastructure/container/Provider.yml'), 'utf8');
  const cloud = readFileSync(resolve(root, 'infrastructure/cloud/Topology.yml'), 'utf8');
  for (const workload of ['shop-api', 'shop-jobs', 'shop-provider']) {
    const source = workload === 'shop-provider' ? provider : runtime;
    assert.match(source, new RegExp(`name: ${workload}[\\s\\S]*?kind: PodDisruptionBudget[\\s\\S]*?minAvailable: [12]`));
  }
  assert.ok((`${runtime}\n${provider}`.match(/topologyKey: topology\.kubernetes\.io\/zone/g) ?? []).length >= 3);
  assert.match(cloud, /zones: 2/);
  assert.match(cloud, /synchronousStandby: true/);
});

test('ordinary and provider queue backlogs trigger bounded horizontal scaling', () => {
  const runtime = readFileSync(resolve(root, 'infrastructure/container/Runtime.yml'), 'utf8');
  const provider = readFileSync(resolve(root, 'infrastructure/container/Provider.yml'), 'utf8');
  assert.match(runtime, /name: shop-jobs[\s\S]*?kind: HorizontalPodAutoscaler[\s\S]*?shop_job_queue_depth[\s\S]*?shop_job_oldest_message_seconds/);
  assert.match(runtime, /maxReplicas: 20/);
  assert.match(provider, /shop_provider_queue_depth/);
  assert.match(provider, /maxReplicas: 30/);
});

test('support realtime remains recoverable across Redis loss and message data remains fail-closed across KMS loss', () => {
  const relay = readFileSync(resolve(root, 'services/commerce/src/modules/support/application/process/RelaySupportEvents.ts'), 'utf8');
  const messages = readFileSync(resolve(root, 'services/commerce/src/modules/support/application/service/SendSupportMessage.ts'), 'utf8');
  const eventRepository = readFileSync(resolve(root, 'services/commerce/src/modules/support/infrastructure/persistence/PgSupportEventRepository.ts'), 'utf8');
  assert.ok(relay.indexOf('this.realtime.publish') < relay.indexOf('this.outbox.complete'));
  assert.match(relay, /this\.outbox\.fail/);
  assert.match(eventRepository, /supportrelay/);
  assert.ok(messages.indexOf('kms.encrypt') < messages.indexOf('sendMessage'));
  assert.doesNotMatch(relay, /message\.body|body_ciphertext/);
});

test('deployment evidence locks customer support recovery to RPO 0 and RTO 15 minutes', () => {
  const telemetry = readFileSync(resolve(root, 'config/telemetry.yml'), 'utf8');
  const backup = readFileSync(resolve(root, 'infrastructure/backup/Policy.yml'), 'utf8');
  assert.match(`${telemetry}\n${backup}`, /rpoMinutes: 0/);
  assert.match(`${telemetry}\n${backup}`, /rtoMinutes: 15/);
  assert.doesNotMatch(backup, /rpoMinutes: [1-9]/);
  assert.doesNotMatch(backup, /rtoMinutes: (?:[2-9]\d|1[6-9])/);
});
