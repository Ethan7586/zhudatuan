import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const supportViewModel = defineSupplierViewModel({ routes: ['suppliersupport'], title: '客服协同', description: '查看与供应商订单相关的客服工单和处理状态。', read: (client, context) => client.support.casesRead({ query: { limit: 50 } }, context) });
