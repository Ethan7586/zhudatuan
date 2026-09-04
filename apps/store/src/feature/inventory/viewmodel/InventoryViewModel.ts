import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const inventoryViewModel = defineStoreViewModel({ routes: ['storeinventorywork'], title: '库存查询', description: '查看服务端权威在手量、预占量和可用量。', read: (client, context) => client.inventory.availabilityRead({ query: {} }, context) });
