import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const ProductManifest = defineManifest({ feature: 'product', routes: [{ routeid: 'storeproduct', protected: false, load: () => import('./route/ProductRoute') }] });
