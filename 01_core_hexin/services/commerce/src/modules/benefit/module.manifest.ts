import { defineModuleManifest } from '@shop/kernel';
import { BENEFIT_CAPABILITIES } from './01_public_gongkai/BenefitCapabilities';

export const benefitManifest = defineModuleManifest({
  id: 'benefit',
  version: '1.0.0',
  kind: 'business',
  provides: [BENEFIT_CAPABILITIES.read, BENEFIT_CAPABILITIES.manage],
  requires: ['member', 'finance'],
  operations: [
    'benefit.accounts.read',
    'benefit.ledgers.read',
    'benefit.plans.read',
    'benefit.plans.manage',
    'benefit.budgets.read',
    'benefit.budgets.manage',
    'benefit.grants.create',
    'benefit.grants.decide',
    'benefit.grants.read',
    'benefit.grants.control',
    'benefit.grants.revoke',
    'benefit.lots.read',
  ],
  publishes: [
    'benefit.granted',
    'benefit.expired',
    'benefit.expiry.reminded',
    'benefit.revoked',
    'benefit.grant.failed',
    'benefit.revoke.failed',
    'benefit.expiry.failed',
  ],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['benefitOperations'],
    jobs: ['benefitgrant', 'benefitexpiry'],
  },
});
