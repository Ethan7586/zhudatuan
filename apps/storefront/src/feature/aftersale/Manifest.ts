import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const AfterSaleManifest = defineManifest({ feature: 'aftersale', routes: [{ routeid: 'storeaftersale', protected: true, load: () => import('./route/AfterSaleRoute') }] });
