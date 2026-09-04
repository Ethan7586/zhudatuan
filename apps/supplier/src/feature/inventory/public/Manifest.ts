import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const inventoryManifest = defineSupplierFeature('inventory', [{ routeid: 'supplierinventory', title: '库存同步', breadcrumbs: ['供应链后台', '库存同步'], load: () => import('../route/InventoryRoute') }]);
