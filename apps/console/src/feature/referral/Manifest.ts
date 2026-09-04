import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ReferralManifest = defineComponent({
  component: 'referral',
  navigationids: ['distributionreferral', 'groupreferral', 'mallreferral', 'distributionreferralview', 'groupreferralview', 'mallreferralview'],
  routes: [
    { routeid: 'consolereferral', load: () => import('./route/ReferralRoute') },
    { routeid: 'consolereferralview', load: () => import('./route/ReferralRoute') },
  ],
  load: () => import('./route/ReferralRoute'),
});
