import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const NotificationManifest = defineComponent({
  component: 'notification',
  navigationids: ['groupmessage', 'mallmessage'],
  routes: [{ route: 'settings/messages' }],
  load: () => import('./NotificationRoute'),
});
