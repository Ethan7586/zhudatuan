import { journey } from './JourneyHarness';
journey('MVP07', { workstation: 'groupproduct', operations: ['catalog.pools.read', 'catalog.products.create', 'catalog.listings.batch', 'pricing.rules.publish'], tables: ['catalog.pool', 'catalog.product', 'catalog.listing'], event: 'catalog.listing.published' });
