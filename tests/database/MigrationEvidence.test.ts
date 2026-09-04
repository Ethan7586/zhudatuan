import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMigrationEvidence, contentHash } from '../../database/tools/MigrationEvidence.mjs';

const sha = 'a'.repeat(64);

function evidence(phase: 'before' | 'after') {
  return {
    schema: 'shop.migration.evidence.v1', phase, requestId: `${phase}:request`, capturedAt: '2026-09-06T00:00:00.000Z', sampleSeed: 'sample-seed-20260906',
    schemaHead: { contractVersion: '5.0.0', migrationHead: '20260904065000', checksum: sha, migrationCount: 414 },
    durationMs: phase === 'after' ? 1200 : 0, maximumLockWaitMs: phase === 'after' ? 30 : 0,
    metrics: {
      tableCounts: { 'ordering.orderrecord': 1 }, distributions: [{ table: 'ordering.orderrecord', scope: 'scope:one', state: 'paid', count: 1 }],
      amountsMinor: { 'ordering.orderrecord.total_minor': '100' }, inventory: { onhand: 10, reserved: 2 },
      voucher: { vouchers: 1, remainingMinor: 100 }, sampleHashes: { 'ordering.orderrecord': { count: 1, hash: sha } },
    },
    invariants: { orphanCount: 0, duplicateBusinessKeyCount: 0, undecryptableSecretCount: 0, unbalancedJournalCount: 0,
      negativeInventoryCount: 0, rls: { passed: true, scopeLeaks: 0, writeRejected: true } },
    checkpoints: { imports: [], migrationEvidenceCount: 98 }, connectionDetailsEmitted: false, secretValuesEmitted: false,
  };
}

test('数值完全一致时迁移证据通过', () => {
  const result = compareMigrationEvidence(evidence('before'), evidence('after'), [], {
    schemaHead: '20260904065000', maximumLockWaitMs: 5000, maximumDurationMs: 60_000,
  });
  assert.deepEqual(result, { exact: true, differences: [], approvals: 0, passed: true });
});

test('未逐条批准的差异阻断发布', () => {
  const after = evidence('after');
  after.metrics.tableCounts['ordering.orderrecord'] = 2;
  assert.throws(() => compareMigrationEvidence(evidence('before'), after), /MIGRATION_EVIDENCE_DIFFERENCE_UNAPPROVED/);
});

test('逐条绑定源值、目标值与审批证据后允许业务差异', () => {
  const after = evidence('after');
  after.metrics.tableCounts['ordering.orderrecord'] = 2;
  const result = compareMigrationEvidence(evidence('before'), after, [{
    path: 'metrics.tableCounts.ordering.orderrecord', source: 1, target: 2, approvedBy: 'actor:finance-owner',
    reason: 'approved migration transformation', evidenceSha256: sha,
  }]);
  assert.equal(result.exact, false);
  assert.equal(result.approvals, 1);
});

test('孤儿、重复键、不可解密 Secret、账务不平与负库存不可审批', () => {
  for (const field of ['orphanCount', 'duplicateBusinessKeyCount', 'undecryptableSecretCount', 'unbalancedJournalCount', 'negativeInventoryCount']) {
    const after = evidence('after');
    after.invariants[field] = 1;
    assert.throws(() => compareMigrationEvidence(evidence('before'), after), new RegExp(`MIGRATION_EVIDENCE_INVARIANT_FAILED:${field}`));
  }
});

test('证据内容 Hash 不依赖自身 Hash 字段', () => {
  const value = evidence('after');
  const first = contentHash(value);
  value.contentSha256 = 'b'.repeat(64);
  assert.equal(contentHash(value), first);
});
