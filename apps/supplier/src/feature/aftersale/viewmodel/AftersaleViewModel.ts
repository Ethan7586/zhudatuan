import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const aftersaleViewModel = defineSupplierViewModel({ routes: ['supplierreturns'], title: '退货处理', description: '查看售后、退货收货和质检协同状态。', read: (client, context) => client.order.aftersalesRead({ query: { limit: 50 } }, context) });
