import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const invoiceViewModel = defineSupplierViewModel({ routes: ['supplierinvoice'], title: '发票协同', description: '查看与供应商结算相关的发票申请及处理状态。', read: (client, context) => client.invoice.requestsRead({ query: { limit: 50 } }, context) });
