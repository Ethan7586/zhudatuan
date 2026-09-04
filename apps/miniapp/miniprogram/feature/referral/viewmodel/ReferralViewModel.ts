import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const referralViewModel = defineMiniappFeature({
  defaultRoute: 'miniappreferral', routes: ['miniappreferral'], title: '推荐收益', description: '查看推荐关系与已入账收益。',
  read: (client, context) => client.referral.earningsRead({ query: { limit: '30' } }, context),
});
