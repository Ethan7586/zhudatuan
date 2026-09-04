import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const inventoryViewModel = defineSupplierViewModel({ routes: ['supplierinventory'], title: '库存同步', description: '查看权威在手量、预占量和可用量，避免本地库存覆盖平台事实。', read: (client, context) => client.inventory.availabilityRead({ query: {} }, context) });
