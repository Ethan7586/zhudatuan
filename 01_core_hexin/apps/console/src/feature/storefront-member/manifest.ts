import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const storefrontMembersModule = {
  id: 'storefront-members',
  status: 'enabled',
  navigation: {
    placement: 'main', group: 'organization', order: 95, label: '商城会员', icon: 'members', scopeKinds: ['mall'],
  },
  routes: [{
    id: 'storefront-members.index',
    path: 'storefront-members',
    kind: 'entry',
    lazy: () => import('./StorefrontMemberRoute'),
    operations: ['member.storefront.members.read'],
    presentation: { title: '商城会员', summary: '当前商城的消费者 Membership 名单' },
  }],
} as const satisfies ConsoleModuleManifest<'storefront-members'>;
