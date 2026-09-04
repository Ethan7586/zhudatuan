import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const catalogManifest = defineSupplierFeature('catalog', [{ routeid: 'suppliercatalog', title: '商品目录', breadcrumbs: ['供应链后台', '商品目录'], load: () => import('../route/CatalogRoute') }]);
