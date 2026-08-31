import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ProductManifest = defineComponent({
  component: 'product',
  navigationids: ['platformcatalog', 'groupproduct', 'mallproduct'],
  load: () => import('./ProductRoute'),
  routes: [{ route: 'products' }, { route: 'products/:productId', load: () => import('./ProductDetailRoute') }, { route: 'imports/:kind/:jobId', load: () => import('./importing/ImportRoute') }],
});
