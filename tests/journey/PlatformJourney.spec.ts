import { journey } from './JourneyHarness';
journey('MVPPLATFORM', {
  workstation: 'platform',
  operations: ['organization.layers.read', 'catalog.pools.attach', 'catalog.pools.detach', 'voucher.credentialpools.create'],
  tables: ['organization.organization', 'catalog.poolbinding', 'voucher.credentialpool'],
  event: 'catalog.listing.published',
});
