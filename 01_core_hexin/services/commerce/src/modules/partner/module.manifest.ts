import { defineModuleManifest } from '@shop/kernel';
import { PARTNER_CAPABILITIES } from './01_public_gongkai/PartnerCapabilities';

export const partnerManifest = defineModuleManifest({
  id: 'partner',
  version: '1.0.0',
  kind: 'business',
  provides: [PARTNER_CAPABILITIES.read, PARTNER_CAPABILITIES.manage],
  requires: ['organization'],
  operations: ['partner.partners.read', 'partner.partners.manage', 'organization.stores.read', 'organization.stores.manage'],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['partnerOperations'],
    jobs: [],
  },
});
