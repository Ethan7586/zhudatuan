import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const InvitationManifest = defineComponent({
  component: 'invitation',
  navigationids: ['groupinvitation', 'mallinvitation'],
  routes: [{ route: 'settings/invitations' }],
  load: () => import('./ui/InvitationRoute'),
});
