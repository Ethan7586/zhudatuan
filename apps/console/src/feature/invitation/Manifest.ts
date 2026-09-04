import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const InvitationManifest = defineComponent({
  component: 'invitation',
  navigationids: ['groupinvitation', 'mallinvitation'],
  routes: [{ routeid: 'consoleinvitations' }],
  load: () => import('./route/InvitationRoute'),
});
