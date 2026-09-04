import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const PartnerManifest = defineComponent({
  component: 'partner',
  navigationids: ['grouppartner', 'mallpartner'],
  load: () => import('./route/PartnerRoute'),
  routes: [{ routeid: 'consolepartners' }],
});
