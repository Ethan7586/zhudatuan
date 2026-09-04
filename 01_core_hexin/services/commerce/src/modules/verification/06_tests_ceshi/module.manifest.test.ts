import { describe, expect, it } from 'vitest';
import { VERIFICATION_CAPABILITIES, verificationManifest } from '..';

describe('verification module manifest', () => {
  it('keeps the stable module identity behind the pinyin-readable directory', () => {
    expect(verificationManifest.id).toBe('verification');
    expect(verificationManifest.provides).toEqual([VERIFICATION_CAPABILITIES.read, VERIFICATION_CAPABILITIES.manage]);
    expect(verificationManifest.publicEntry).toBe('./index.ts');
  });

  it('owns the complete canonical verification operation set', () => {
    expect(verificationManifest.operations).toEqual([
      'verification.sessions.read',
      'verification.challenges.issue',
      'verification.challenges.verify',
      'verification.history.read',
      'verification.devices.read',
      'verification.devices.manage',
    ]);
  });
});
