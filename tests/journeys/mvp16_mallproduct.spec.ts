import { journey } from './JourneyHarness';
journey('MVP16', { workstation: 'mallproduct', operations: ['catalog.listings.read', 'catalog.products.create', 'catalog.listings.batch', 'pricing.rules.publish'], tables: ['catalog.product', 'catalog.listing', 'pricing.rule'], event: 'catalog.listing.published' });
