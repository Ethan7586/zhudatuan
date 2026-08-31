import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const RiskManifest = defineComponent({
  component: 'risk',
  navigationids: ['grouprisk', 'mallrisk'],
  routes: [{ route: 'settings/risk' }],
  load: () => import('./RiskRoute'),
});
