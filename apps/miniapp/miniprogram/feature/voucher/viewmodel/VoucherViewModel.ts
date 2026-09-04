import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const voucherViewModel = defineMiniappFeature({
  defaultRoute: 'miniappvouchers', routes: ['miniappvouchers'], title: '我的卡券', description: '查看持有卡券、有效期与当前可用状态。',
  read: (client, context) => client.voucher.searchRead({ query: { limit: 30 } }, context),
});
