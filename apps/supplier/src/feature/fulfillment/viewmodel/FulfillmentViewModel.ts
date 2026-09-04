import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const fulfillmentViewModel = defineSupplierViewModel({ routes: ['suppliershipments'], title: '发货管理', description: '查看订单履约进度并进入服务端受控发货流程。', read: (client, context) => client.order.ordersRead({ query: { limit: 50 } }, context) });
