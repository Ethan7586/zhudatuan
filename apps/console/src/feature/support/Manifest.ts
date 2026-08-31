import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const SupportManifest = defineComponent({
  component: 'support',
  navigationids: ['groupsupport', 'mallsupport'],
  load: () => import('./SupportRoute'),
  routes: [{ route: 'support' }, { route: 'support/:caseId' }],
});
