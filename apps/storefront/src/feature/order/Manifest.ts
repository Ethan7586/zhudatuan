import { defineManifest } from '../../shared/manifest/StorefrontManifest';
export const OrderManifest = defineManifest({
  feature: 'order',
  routes: [
    { routeid: 'storeorders', protected: true, load: () => import('./route/OrderRoute') },
    { routeid: 'storeorder', protected: true, load: () => import('./route/OrderDetailRoute') },
  ],
});
