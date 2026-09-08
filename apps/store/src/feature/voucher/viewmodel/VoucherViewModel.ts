import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import { verificationHistory } from '../../../shared/Verification';
export const voucherViewModel = defineStoreViewModel({
  routes: ['storevoucherswork'],
  title: '核销记录',
  description: '按门店范围查看服务端保存的核销结果、失败原因、设备和操作时间。',
  read: (client, context) => client.verification.historyRead({ query: { limit: 50 } }, context),
  project: verificationHistory,
});
