import { defineModuleManifest } from '@shop/kernel';
import { REFERRAL_CAPABILITIES } from './01_public_gongkai/ReferralCapabilities';

export const referralManifest = defineModuleManifest({
  id: 'referral',
  version: '1.0.0',
  kind: 'business',
  provides: [REFERRAL_CAPABILITIES.read, REFERRAL_CAPABILITIES.manage],
  requires: ['member', 'catalog', 'finance'],
  operations: [
    'referral.settings.read',
    'referral.settings.manage',
    'referral.products.read',
    'referral.products.manage',
    'referral.members.read',
    'referral.members.apply',
    'referral.members.approve',
    'referral.members.disqualify',
    'referral.bindings.read',
    'referral.bindings.create',
    'referral.commissions.read',
    'referral.earnings.read',
    'referral.links.read',
    'referral.withdrawals.read',
    'referral.withdrawals.create',
  ],
  publishes: [],
  consumes: ['order.placed', 'order.paid', 'order.received', 'order.cancelled', 'payment.refunded'],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'interface', 'tests'],
  entrypoints: {
    http: ['referralOperations', 'referralOperatorReadOperations'],
    jobs: ['referral'],
  },
});
