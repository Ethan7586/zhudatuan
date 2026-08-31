import { journey } from './JourneyHarness';
journey('MVPPLATFORM', {
  workstation: 'platform',
  operations: ['organization.layers.read', 'catalog.pools.attach', 'catalog.pools.detach', 'voucher.cardlibraries.create'],
  tables: ['organization.organization', 'catalog.poolbinding', 'voucher.cardpool'],
  event: 'catalog.listing.published',
});
