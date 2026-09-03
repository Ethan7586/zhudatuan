import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const MemberManifest = defineComponent({
  component: 'member',
  navigationids: ['groupmemberdata', 'mallmemberdata'],
  routes: [{ routeid: 'consolemembers' }],
  load: () => import('./MemberRoute'),
});
