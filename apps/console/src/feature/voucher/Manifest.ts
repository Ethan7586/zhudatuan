import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const VoucherManifest = defineComponent({
  component: 'voucher',
  navigationids: ['platformvoucher', 'groupvoucher', 'mallvoucher'],
  routes: [{ routeid: 'consolevouchers' }],
  load: () => import('./route/VoucherRoute'),
});
