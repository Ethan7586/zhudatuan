import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const SettingsManifest = defineComponent({
  component: 'settings',
  navigationids: ['groupsettings', 'mallsettings'],
  routes: [{ routeid: 'consolesettings' }],
  load: () => import('./SettingsRoute'),
});
