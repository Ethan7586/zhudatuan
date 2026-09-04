import { defineModuleManifest } from '@shop/kernel';
import { QUALIFICATION_CAPABILITIES } from './01_public_gongkai/QualificationCapabilities';

export const qualificationManifest = defineModuleManifest({
  id: 'qualification',
  version: '1.0.0',
  kind: 'business',
  provides: [QUALIFICATION_CAPABILITIES.read, QUALIFICATION_CAPABILITIES.manage],
  requires: ['member.read'],
});
