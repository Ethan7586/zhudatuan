import { storefrontJourney } from './StorefrontJourneyHarness';
storefrontJourney('storefront member asset journey', {
  operations: ['member.addresses.read', 'member.addresses.manage', 'invoice.profiles.read', 'invoice.requests.create', 'voucher.bindings.read', 'benefit.accounts.read'],
  routes: ['/profile', '/vouchers', '/benefits'],
  sources: ['apps/storefront/src/feature/account/infrastructure/AccountGateway.ts', 'apps/storefront/src/feature/voucher/infrastructure/VoucherGateway.ts', 'apps/storefront/src/feature/benefit/infrastructure/BenefitGateway.ts'],
  markers: [/addresses/, /voucher/, /accounts/],
});
