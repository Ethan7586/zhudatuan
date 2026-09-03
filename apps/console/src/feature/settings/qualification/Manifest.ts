import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const QualificationManifest = defineComponent({
  component: 'qualification',
  navigationids: ['groupqualification', 'mallqualification'],
  routes: [{ routeid: 'consolequalification' }],
  load: () => import('./QualificationRoute'),
});
