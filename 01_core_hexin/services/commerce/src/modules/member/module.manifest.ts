import { defineModuleManifest } from '@shop/kernel';
import { MEMBER_CAPABILITIES } from './01_public_gongkai/MemberCapabilities';

export const memberManifest = defineModuleManifest({
  id: 'member',
  version: '1.0.0',
  kind: 'business',
  provides: [MEMBER_CAPABILITIES.read, MEMBER_CAPABILITIES.manage],
  requires: ['identity'],
  operations: [
    'member.profile.read',
    'member.addresses.read',
    'member.addresses.manage',
    'member.members.read',
    'member.invitations.read',
    'member.imports.read',
    'member.imports.create',
  ],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['memberOperations', 'memberOperatorReadOperations'],
    jobs: ['memberimport'],
  },
});
