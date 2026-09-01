import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront member journey', {
  operations: ['identity.memberships.read', 'identity.memberships.switch', 'member.addresses.read', 'member.favorites.read'],
  routes: ['/profile'],
  sources: [
    'services/commerce/src/modules/identity/application/service/ReadMemberships.ts',
    'services/commerce/src/modules/identity/application/service/SwitchMembership.ts',
    'apps/storefront/src/feature/account/infrastructure/AccountGateway.ts',
  ],
  markers: [/membership/, /revokeCurrent/, /favorites/],
});
