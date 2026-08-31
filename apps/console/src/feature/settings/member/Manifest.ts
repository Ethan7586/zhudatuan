import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const MemberManifest = defineComponent({
  component: 'member',
  navigationids: ['groupmemberdata', 'mallmemberdata'],
  routes: [{ route: 'settings/members' }],
  load: () => import('./MemberRoute'),
});
