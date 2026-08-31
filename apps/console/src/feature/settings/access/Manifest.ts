import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const AccessManifest = defineComponent({
  component: 'access',
  navigationids: ['groupadmin', 'malladmin'],
  routes: [{ route: 'settings/access' }],
  load: () => import('./AccessRoute'),
});
