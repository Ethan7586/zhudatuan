import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const voucherViewModel = defineStoreViewModel({ routes: ['storevoucherswork'], title: '核销记录', description: '按门店范围查看可追溯的凭证核销记录。', read: (client, context) => client.verification.historyRead({ query: { limit: 50 } }, context) });
