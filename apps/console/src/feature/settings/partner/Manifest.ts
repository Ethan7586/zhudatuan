import { defineComponent } from '../../../shared/manifest/ComponentManifest';

export const PartnerManifest = defineComponent({
  component: 'partner',
  navigationids: ['grouppartner', 'mallpartner'],
  load: () => import('./PartnerRoute'),
  routes: [{ route: 'settings/partners' }, { route: 'settings/partners/qualifications', load: () => import('../qualification/QualificationRoute') }],
});
