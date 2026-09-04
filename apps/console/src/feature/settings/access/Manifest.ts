import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const AccessManifest = defineComponent({
  component: 'access',
  navigationids: ['groupadmin', 'malladmin'],
  routes: [{ routeid: 'consoleaccess' }],
  load: () => import('./route/AccessRoute'),
});
