import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ReportingManifest = defineComponent({
  component: 'reporting',
  navigationids: ['groupreporting', 'mallreporting'],
  routes: [{ routeid: 'consolereporting' }],
  load: () => import('./route/ReportingRoute'),
});
