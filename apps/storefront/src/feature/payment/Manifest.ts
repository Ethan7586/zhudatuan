import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const PaymentManifest = defineManifest({ feature: 'payment', routes: [{ routeid: 'storepayment', protected: true, load: () => import('./route/PaymentRoute') }] });
