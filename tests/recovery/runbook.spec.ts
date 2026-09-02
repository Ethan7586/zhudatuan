import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { JOB_CATALOG } from '../../services/commerce/src/foundation/application/JobCatalog';

const root = process.cwd();
const incidents = [
  'databasefailover',
  'migrationrollback',
  'paymentincident',
  'refundrepair',
  'inventoryrepair',
  'ledgerrepair',
  'outboxreplay',
  'deadletterreplay',
  'channeldegrade',
  'credentialrotation',
  'crosstenantincident',
  'databackfill',
  'mallrollback',
  'releaserollback',
  'cachefailure',
  'queuebacklog',
  'workloadloss',
  'zonefailure',
];
const topics = ['trigger', 'impact', 'owner', 'stop loss', 'diagnosis', 'recovery', 'data repair', 'validation', 'escalation', 'audit', 'postmortem'];

test('every registered job links to a complete owner runbook', () => {
  for (const job of JOB_CATALOG) {
    const path = join(root, job.runbook);
    assert.equal(existsSync(path), true, `${job.id} runbook is missing`);
    const text = readFileSync(path, 'utf8').toLowerCase();
    for (const topic of topics) assert.match(text, new RegExp(topic.replace(' ', '.?')), `${job.id} lacks ${topic}`);
    assert.equal(job.deadLetter, 'runtime.deadletter');
    assert.equal(job.idempotency, 'jobid');
  }
});

test('all mandatory incident recovery runbooks contain business validation and evidence', () => {
  for (const name of incidents) {
    const text = readFileSync(join(root, `runbooks/${name}.md`), 'utf8').toLowerCase();
    for (const topic of ['trigger', 'impact', 'owner', 'stop loss', 'diagnosis', 'recovery', 'data repair', 'validation', 'escalation', 'audit', 'postmortem']) {
      assert.match(text, new RegExp(topic.replace(' ', '.?')), `${name} lacks ${topic}`);
    }
  }
});

test('recovery configuration declares the required RPO, RTO and immutable evidence checks', () => {
  const telemetry = readFileSync(join(root, 'config/telemetry.yml'), 'utf8');
  assert.match(telemetry, /rpoMinutes: 0/);
  assert.match(telemetry, /rtoMinutes: 15/);
  const database = readFileSync(join(root, 'runbooks/databasefailover.md'), 'utf8');
  assert.match(database, /LSN/);
  assert.match(database, /RPO 0/);
  assert.match(database, /RTO 15/);
  assert.match(readFileSync(join(root, 'runbooks/migrationrollback.md'), 'utf8'), /94 historical hashes/);
  const topology = readFileSync(join(root, 'infrastructure/cloud/Topology.yml'), 'utf8');
  const backup = readFileSync(join(root, 'infrastructure/backup/Policy.yml'), 'utf8');
  assert.match(topology, /synchronousStandby: true/);
  assert.match(topology, /separateRegion: true/);
  assert.match(backup, /continuousWalArchive: true/);
  assert.match(backup, /pointInTimeRecovery: true/);
  assert.match(backup, /rpoMinutes: 0/);
  assert.match(backup, /rtoMinutes: 15/);
});
