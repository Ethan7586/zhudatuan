import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const orderViewModel = defineSupplierViewModel({ routes: ['supplierorders'], title: '订单处理', description: '查看需要确认、备货和异常处理的供应商订单。', read: (client, context) => client.order.ordersRead({ query: { limit: 50 } }, context) });
