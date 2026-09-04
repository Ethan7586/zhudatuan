import { defineModuleManifest } from '@shop/kernel';
import { VERIFICATION_CAPABILITIES } from './01_public_gongkai/VerificationCapabilities';

export const verificationManifest = defineModuleManifest({
  id: 'verification',
  version: '1.0.0',
  kind: 'business',
  provides: [VERIFICATION_CAPABILITIES.read, VERIFICATION_CAPABILITIES.manage],
  requires: ['member.read', 'partner.read'],
  operations: [
    'verification.sessions.read',
    'verification.challenges.issue',
    'verification.challenges.verify',
    'verification.history.read',
    'verification.devices.read',
    'verification.devices.manage',
  ],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['verificationOperations'],
  },
});
