import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const FederationManifest = defineComponent({
  component: 'federation',
  navigationids: ['groupprovider', 'mallprovider'],
  routes: [{ routeid: 'consolefederation' }],
  load: () => import('./FederationRoute'),
});
