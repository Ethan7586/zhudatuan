import { journey } from './JourneyHarness';
journey('MVP04', { workstation: 'distribution', operations: ['channel.distributors.create', 'channel.distributors.read', 'channel.quotas.manage', 'catalog.pools.allocate'], tables: ['channel.distributor', 'channel.tenantbinding', 'catalog.poolbinding'], event: 'access.version.changed' });
