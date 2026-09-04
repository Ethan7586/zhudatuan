import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const inventoryManifest = defineStoreFeature('inventory', [{ routeid: 'storeinventorywork', title: '库存查询', breadcrumbs: ['门店工作台', '库存查询'], load: () => import('../route/InventoryRoute') }]);
