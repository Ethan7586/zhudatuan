import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const ProviderManifest = defineComponent({
  component: 'identityprovider',
  navigationids: ['groupprovider', 'mallprovider'],
  routes: [{ route: 'settings/login' }],
  load: () => import('./ProviderRoute'),
});
