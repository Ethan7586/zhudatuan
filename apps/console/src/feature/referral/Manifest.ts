import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ReferralManifest = defineComponent({
  component: 'referral',
  navigationids: ['groupreferral', 'mallreferral'],
  routes: [
    { routeid: 'consolereferral', load: () => import('./route/ReferralRoute') },
    { routeid: 'consolereferralview', load: () => import('./route/ReferralRoute') },
  ],
  load: () => import('./route/ReferralRoute'),
});
