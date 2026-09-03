import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const NotificationManifest = defineComponent({
  component: 'notification',
  navigationids: ['groupmessage', 'mallmessage'],
  routes: [{ routeid: 'consolenotifications' }],
  load: () => import('./NotificationRoute'),
});
