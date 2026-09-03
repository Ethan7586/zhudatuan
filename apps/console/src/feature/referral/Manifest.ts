import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ReferralManifest = defineComponent({
  component: 'referral',
  navigationids: ['groupreferral', 'mallreferral'],
  routes: [
    { routeid: 'consolereferral', load: () => import('./ReferralRoute') },
    { routeid: 'consolereferralview', load: () => import('./ReferralRoute') },
  ],
  load: () => import('./ReferralRoute'),
});
