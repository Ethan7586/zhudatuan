import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ProductManifest = defineComponent({
  component: 'product',
  navigationids: ['platformcatalog', 'groupproduct', 'mallproduct'],
  load: () => import('./route/ProductRoute'),
  routes: [{ routeid: 'consoleproducts' }, { routeid: 'consoleproductdetail', load: () => import('./route/ProductDetailRoute') }, { routeid: 'consoleproductimport', load: () => import('./importing/ImportRoute') }],
});
