import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const CartManifest = defineManifest({ feature: 'cart', routes: [{ routeid: 'storecart', protected: true, load: () => import('./route/CartRoute') }] });
