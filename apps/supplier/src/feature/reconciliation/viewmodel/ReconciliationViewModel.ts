import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const reconciliationViewModel = defineSupplierViewModel({ routes: ['supplierreconciliation'], title: '对账处理', description: '查看对账差异与证据，敏感读取由服务端二次核验。', read: (client, context) => client.finance.reconciliationsRead({ query: { limit: 50 } }, context) });
