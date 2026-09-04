import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const fulfillmentViewModel = defineStoreViewModel({ routes: ['storefulfillment'], title: '发货管理', description: '集中查看待发货、运输中和需要协同处理的业务。', read: (client, context) => client.order.ordersRead({ query: { limit: 50 } }, context) });
