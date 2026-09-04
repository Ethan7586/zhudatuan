import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront support journey', {
  operations: [
    'support.attachments.create',
    'support.cases.create',
    'support.cases.read',
    'support.events.read',
    'support.messages.read',
    'support.messages.send',
    'support.readstates.manage',
  ],
  routes: ['/support', '/support/:caseId'],
  sources: [
    'services/commerce/src/modules/support/infrastructure/persistence/PgConversationRepository.ts',
    'apps/storefront/src/feature/support/infrastructure/SupportGateway.ts',
    'apps/storefront/src/feature/support/application/ListenSupportEvents.ts',
  ],
  markers: [/attachment/, /conversation/, /member/, /Last-Event-ID|lastEventId/, /readstate/i],
});
