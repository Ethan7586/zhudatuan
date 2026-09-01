import { journey } from './JourneyHarness';

const entryOperations = [
  'experience.applications.create',
  'experience.applications.copy',
  'experience.applications.detail.read',
  'experience.applications.read',
  'experience.versions.save',
  'experience.versions.validate',
  'experience.versions.publish',
  'experience.versions.restore',
  'storefront.bootstrap.read',
] as const;
const entryTables = ['organization.organization', 'catalog.pool', 'experience.application', 'experience.version', 'experience.release', 'experience.publication'] as const;

journey('MVPGROUPAPPLICATION', {
  workstation: 'mallentry',
  operations: entryOperations,
  tables: entryTables,
  event: 'experience.published',
});
