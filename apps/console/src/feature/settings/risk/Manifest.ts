import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const RiskManifest = defineComponent({
  component: 'risk',
  navigationids: ['grouprisk', 'mallrisk'],
  routes: [{ routeid: 'consolerisk' }],
  load: () => import('./route/RiskRoute'),
});
