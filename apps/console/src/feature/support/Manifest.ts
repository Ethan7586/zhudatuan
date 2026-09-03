import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const SupportManifest = defineComponent({
  component: 'support',
  navigationids: ['groupsupport', 'mallsupport'],
  load: () => import('./route/SupportRoute'),
  routes: [{ routeid: 'consolesupport' }, { routeid: 'consolesupportcase' }],
});
