import { describe, expect, it } from 'vitest';
import { MINIAPP_DEVICE_SCENARIOS, validateDeviceEvidence } from '../scripts/DeviceEvidence';

const hash = 'a'.repeat(64);
const evidenceHash = 'b'.repeat(64);
const now = new Date('2026-09-07T00:00:00.000Z');

function evidence() {
  return {
    schema: 'shop.miniapp.device.v1', artifactSha256: hash, capturedAt: '2026-09-06T00:00:00.000Z', approvedAt: '2026-09-06T01:00:00.000Z', approvedBy: 'qa@example.com',
    records: [
      { source: 'developertool', device: '微信开发者工具', system: 'macOS', wechat: 'stable', network: 'normal', scenario: 'safearea', passed: true, evidenceSha256: evidenceHash },
      ...MINIAPP_DEVICE_SCENARIOS.map((scenario) => ({
        source: 'physical', device: 'physical:fingerprint', system: 'iOS', wechat: 'current',
        network: scenario === 'weaknetwork' ? 'weak' : scenario === 'safearea' ? 'offline' : 'normal', scenario, passed: true, evidenceSha256: evidenceHash,
      })),
    ],
  };
}

describe('miniapp real device evidence gate', () => {
  it('requires developer tool and physical-device evidence for every critical journey', () => {
    expect(validateDeviceEvidence(evidence(), hash, now).records).toHaveLength(10);
  });

  it('rejects evidence for a different artifact and an incomplete physical journey', () => {
    expect(() => validateDeviceEvidence(evidence(), 'c'.repeat(64), now)).toThrow('MINIAPP_DEVICE_ARTIFACT_MISMATCH');
    const missing = evidence();
    missing.records = missing.records.filter(({ scenario }) => scenario !== 'paymentreturn');
    expect(() => validateDeviceEvidence(missing, hash, now)).toThrow('MINIAPP_PHYSICAL_SCENARIO_MISSING:paymentreturn');
  });
});
