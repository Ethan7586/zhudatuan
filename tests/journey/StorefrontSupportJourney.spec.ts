import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront support journey', {
  operations: ['support.cases.create', 'support.cases.read', 'support.messages.read', 'support.messages.send', 'support.attachments.create'],
  routes: ['/support', '/support/:caseId'],
  sources: ['services/commerce/src/modules/support/infrastructure/persistence/PgSupportRepository.ts', 'apps/storefront/src/feature/support/infrastructure/SupportGateway.ts'],
  markers: [/attachment/, /conversation/, /member/],
});
