import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const statementViewModel = defineSupplierViewModel({ routes: ['supplierstatements'], title: '对账账单', description: '查看供应商账单期间、金额和确认状态。', read: (client, context) => client.finance.statementsRead({ query: { limit: 50 } }, context) });
