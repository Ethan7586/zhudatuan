import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const memberCodeViewModel = defineMiniappFeature({
  defaultRoute: 'miniappmembercode',
  routes: ['miniappmembercode'],
  title: '会员码',
  description: '到店出示动态会员码，安全确认当前福利身份。',
  bootstrap: true,
  connect: () => connectMiniappClient({}),
});
