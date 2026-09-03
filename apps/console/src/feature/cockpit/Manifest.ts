import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const CockpitManifest = defineComponent({
  component: 'cockpit',
  navigationids: ['groupdashboard', 'malldashboard'],
  routes: [{ routeid: 'consolecockpit' }],
  load: () => import('./route/CockpitRoute'),
});
