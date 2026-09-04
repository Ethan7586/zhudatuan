import { defineMiniappFeature } from '../../../shared/FeatureViewModel';

export const accountViewModel = defineMiniappFeature({
  defaultRoute: 'miniappprofile', routes: ['miniappprofile', 'miniappsecurity'], title: '我的', description: '管理个人资料、地址、收藏和安全入口。',
  read: (client, context, route) => route.id === 'miniappsecurity'
    ? client.identity.sessionsRead({ query: { limit: 30 } }, context)
    : client.member.profileRead({}, context),
});
