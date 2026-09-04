import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const CartManifest = defineManifest({ feature: 'cart', routes: [{ routeid: 'storecart', protected: false, load: () => import('./route/CartRoute') }] });
