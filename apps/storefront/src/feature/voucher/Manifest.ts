import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const VoucherManifest = defineManifest({ feature: 'voucher', routes: [{ routeid: 'storevouchers', protected: true, load: () => import('./route/VoucherRoute') }] });
