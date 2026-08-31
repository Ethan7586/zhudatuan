import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const DirectoryManifest = defineComponent({
  component: 'directory',
  navigationids: ['groupdirectory', 'malldirectory'],
  routes: [{ route: 'settings/directory' }],
  load: () => import('./DirectoryRoute'),
});
