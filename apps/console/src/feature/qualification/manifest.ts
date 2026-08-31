import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const qualificationModule = {
  id: 'qualification',
  status: 'enabled',
  navigation: { placement: 'main', group: 'organization', order: 110, label: '系统治理台', icon: 'system' },
  routes: [
    {
      id: 'qualification.index',
      path: 'settings/qualification',
      kind: 'entry',
      lazy: () => import('./QualificationRoute'),
      operations: ['qualification.center.read'],
      presentation: { title: '资格管理', summary: '资格策略、版本和发布状态' },
    },
    {
      id: 'qualification.notification',
      path: 'settings/notification',
      kind: 'child',
      lazy: () => import('../notification/NotificationRoute'),
      operations: ['notification.templates.read', 'notification.announcements.read'],
      presentation: { title: '通知管理', summary: '模板、公告和发送边界' },
    },
  ],
} as const satisfies ConsoleModuleManifest<'qualification'>;
