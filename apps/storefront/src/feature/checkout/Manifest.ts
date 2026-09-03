import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const CheckoutManifest = defineManifest({ feature: 'checkout', routes: [{ routeid: 'storecheckout', protected: true, load: () => import('./route/CheckoutRoute') }] });
