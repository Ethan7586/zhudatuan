import { defineModuleManifest } from '@shop/kernel';
import { SUPPORT_CAPABILITIES } from './01_public_gongkai/SupportCapabilities';

export const supportManifest = defineModuleManifest({
  id: 'support',
  version: '1.0.0',
  kind: 'business',
  provides: [SUPPORT_CAPABILITIES.read, SUPPORT_CAPABILITIES.manage],
  requires: ['order', 'member', 'benefit'],
  operations: [
    'support.cases.create',
    'support.cases.read',
    'support.cases.update',
    'support.cases.close',
    'support.cases.reopen',
    'support.messages.send',
    'support.messages.read',
    'support.attachments.create',
    'support.assignments.manage',
    'support.agents.manage',
    'support.agents.read',
    'support.accounts.manage',
    'support.accounts.read',
    'support.rules.read',
    'support.rules.manage',
    'support.slas.read',
    'support.slas.manage',
    'support.history.read',
  ],
  publishes: ['support.message.sent', 'support.ticket.assigned', 'support.sla.escalated'],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'domain', 'application', 'adapters', 'interface', 'tests'],
  entrypoints: {
    http: ['supportRoutes'],
    jobs: ['supportsla', 'supportscan'],
  },
});
