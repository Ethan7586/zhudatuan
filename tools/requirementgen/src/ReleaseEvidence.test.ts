import { describe, expect, it } from 'vitest';

import { isRequirementReleaseEvidence } from './ReleaseEvidence';

const sha = 'a'.repeat(64);

function evidence() {
  return {
    schema: 'shop.requirement.release.v1',
    requirement: 'MVPPLATFORM',
    commit: 'b'.repeat(40),
    sourceTreeHash: sha,
    contractHash: sha,
    migrationHead: '20260904030000',
    artifactDigest: sha,
    bundle: { releaseId: 'release123', candidateSha256: sha, stageSha256: sha, releaseSha256: sha },
    schemaEvidence: { head: '20260904030000', sha256: sha },
    config: { sha256: sha },
    tests: { evidenceSha256: sha },
    metrics: { evidenceSha256: sha },
    approver: { id: 'productowner', evidenceSha256: sha },
    signedAt: '2026-09-08T00:00:00.000Z',
    signature: { method: 'sigstore-keyless', bundleSha256: sha },
  };
}

describe('requirement release evidence', () => {
  it('accepts an evidence chain bound to commit, bundle, schema, config, tests, metrics and approver', () => {
    expect(isRequirementReleaseEvidence(evidence(), 'MVPPLATFORM')).toBe(true);
  });

  it('fails closed for another requirement or an unbound signature receipt', () => {
    expect(isRequirementReleaseEvidence(evidence(), 'MVPIDENTITY')).toBe(false);
    expect(isRequirementReleaseEvidence({ ...evidence(), signature: { method: 'sigstore-keyless', bundleSha256: '' } }, 'MVPPLATFORM')).toBe(false);
  });
});
