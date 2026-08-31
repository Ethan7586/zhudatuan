import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const accessModule = {
  id: 'access',
  status: 'enabled',
  navigation: { placement: 'main', group: 'organization', order: 100, label: '会员与权限', icon: 'members' },
  routes: [
    {
      id: 'access.index',
      path: 'settings/access',
      kind: 'entry',
      lazy: () => import('./AccessRoute'),
      operations: [
        'access.center.read',
        'access.ownership.read',
        'access.ownership.transfers.preview',
        'access.ownership.transfers.create',
        'access.ownership.transfers.accept.preview',
        'access.ownership.transfers.accept',
        'access.ownership.transfers.cancel.preview',
        'access.ownership.transfers.cancel',
        'identity.password.verify',
        'identity.mobile.challenge',
        'identity.mobile.manage',
        'identity.stepup.start',
        'identity.stepup.complete',
      ],
      presentation: { title: '权限中心', summary: '成员角色、授权范围和 Access Version' },
    },
    {
      id: 'access.members',
      path: 'settings/members',
      kind: 'child',
      lazy: () => import('../member/MemberRoute'),
      operations: ['member.members.read', 'identity.invitations.create', 'identity.members.reset'],
      presentation: { title: '成员管理', summary: '成员、员工号和入会状态' },
    },
    {
      id: 'access.member-import',
      path: 'imports/member/:jobId',
      kind: 'technical',
      lazy: () => import('../importing/ImportRoute'),
      operations: ['member.imports.read'],
      presentation: { title: '导入结果', summary: '导入进度、错误行和服务端报告' },
    },
  ],
} as const satisfies ConsoleModuleManifest<'access'>;
