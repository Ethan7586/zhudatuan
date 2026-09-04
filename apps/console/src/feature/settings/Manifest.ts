import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const SettingsManifest = defineComponent({
  component: 'settings',
  navigationids: ['platformsettings', 'distributionsettings', 'groupsettings', 'mallsettings'],
  routes: [{ routeid: 'consolesettings' }],
  load: () => import('./route/SettingsRoute'),
});
