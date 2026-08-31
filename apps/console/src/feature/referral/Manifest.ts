import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ReferralManifest = defineComponent({
  component: 'referral',
  navigationids: ['groupreferral', 'mallreferral'],
  routes: [
    { route: 'referral', load: () => import('./ReferralRoute') },
    { route: 'referral/:view', load: () => import('./ReferralRoute') },
  ],
  load: () => import('./ReferralRoute'),
});
