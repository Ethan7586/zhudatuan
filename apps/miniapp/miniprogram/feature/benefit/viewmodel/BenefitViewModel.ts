import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const benefitViewModel = defineMiniappFeature({
  defaultRoute: 'miniappbenefits', routes: ['miniappbenefits'], title: '福利账户', description: '福利余额、冻结金额与有效批次清晰可核对。',
  read: (client, context) => client.benefit.accountsRead({ query: { limit: 30 } }, context),
});
