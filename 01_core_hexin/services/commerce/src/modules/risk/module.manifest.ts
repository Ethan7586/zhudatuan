import { defineModuleManifest } from '@shop/kernel';
import { RISK_CAPABILITIES } from './01_public_gongkai/RiskCapabilities';

export const riskManifest = defineModuleManifest({
  id: 'risk',
  version: '1.0.0',
  kind: 'business',
  provides: [RISK_CAPABILITIES.read, RISK_CAPABILITIES.manage],
  requires: ['catalog.manage'],
  operations: [
    'risk.center.read',
    'risk.policies.manage',
    'risk.cases.review',
  ],
  publishes: [
    'risk.policy.activated',
    'risk.case.opened',
    'risk.case.resolved',
    'risk.transaction.blocked',
  ],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['riskRoutes'],
    jobs: ['riskscan'],
  },
});
