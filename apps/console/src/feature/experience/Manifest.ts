import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ExperienceManifest = defineComponent({
  component: 'experience',
  navigationids: ['groupapplication', 'malldesign'],
  routes: [{ route: 'experience' }],
  load: () => import('./ExperienceRoute'),
});
