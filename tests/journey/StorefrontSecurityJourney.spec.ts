import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront security journey', {
  operations: ['identity.session.read', 'identity.session.delete', 'identity.password.change', 'identity.mobile.manage', 'identity.stepup.start', 'identity.sessions.revoke'],
  routes: ['/profile/security'],
  sources: ['services/commerce/src/modules/identity/IdentityOperations.ts', 'apps/storefront/src/feature/security/infrastructure/SecurityGateway.ts'],
  markers: [/assurance|stepup/i, /password/, /revoke/],
});
