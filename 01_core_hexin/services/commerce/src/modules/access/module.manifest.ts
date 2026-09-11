import { defineModuleManifest } from '@shop/kernel';
import { ACCESS_CAPABILITIES } from './01_public_gongkai/AccessCapabilities';

export const accessManifest = defineModuleManifest({
  id: 'access',
  version: '1.0.0',
  kind: 'business',
  provides: [ACCESS_CAPABILITIES.read, ACCESS_CAPABILITIES.manage],
  requires: ['identity', 'organization'],
  operations: [
    'access.center.read',
    'access.roles.manage',
    'access.scopes.manage',
    'access.administrators.members.read',
    'access.administrators.member.read',
    'access.administrators.scopes.manage',
    'access.administrators.members.note',
    'access.ownership.read',
    'access.ownership.transfers.preview',
    'access.ownership.transfers.create',
    'access.ownership.transfers.accept.preview',
    'access.ownership.transfers.accept',
    'access.ownership.transfers.cancel.preview',
    'access.ownership.transfers.cancel',
  ],
  publishes: [
    'access.owner.transfer.initiated',
    'access.owner.transferred',
    'access.owner.transfer.cancelled',
    'access.administrator.scope.changed',
    'access.administrator.member.noted',
  ],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['accessOperations', 'accessOperatorReadOperations'],
    jobs: [],
  },
});
