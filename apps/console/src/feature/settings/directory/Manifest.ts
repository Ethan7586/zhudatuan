import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const DirectoryManifest = defineComponent({
  component: 'directory',
  navigationids: ['groupdirectory', 'malldirectory'],
  routes: [{ routeid: 'consoledirectory' }],
  load: () => import('./DirectoryRoute'),
});
