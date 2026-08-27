import { journey } from './JourneyHarness';
journey('MVP15', { workstation: 'malldesign', operations: ['experience.applications.read', 'experience.versions.save', 'experience.versions.validate', 'experience.versions.publish', 'experience.versions.restore'], tables: ['experience.application', 'experience.version', 'experience.release'], event: 'catalog.listing.published' });
