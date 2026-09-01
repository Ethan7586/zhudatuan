import { journey } from './JourneyHarness';
journey('MVPMALLDESIGN', {
  workstation: 'malldesign',
  operations: ['experience.applications.read', 'experience.versions.save', 'experience.versions.validate', 'experience.versions.publish', 'experience.versions.restore', 'storefront.bootstrap.read'],
  tables: ['experience.application', 'experience.version', 'experience.release', 'experience.publication'],
  event: 'catalog.listing.published',
});
