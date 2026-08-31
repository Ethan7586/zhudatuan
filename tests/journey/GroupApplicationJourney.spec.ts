import { journey } from './JourneyHarness';
journey('MVPGROUPAPPLICATION', {
  workstation: 'groupapplication',
  operations: ['experience.applications.create', 'experience.applications.copy', 'experience.versions.save', 'experience.versions.publish'],
  tables: ['experience.application', 'experience.version', 'experience.release'],
  event: 'catalog.listing.published',
});
