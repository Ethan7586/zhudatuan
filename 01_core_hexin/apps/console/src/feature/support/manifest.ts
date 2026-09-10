import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const supportModule = {
  id: 'support',
  status: 'enabled',
  navigation: { placement: 'bottom', group: 'organization', order: 130, label: '服务中心', icon: 'support' },
  routes: [{
    id: 'support.index',
    path: 'support/:caseId?',
    kind: 'entry',
    lazy: () => import('./SupportRoute'),
    operations: ['support.cases.read', 'support.cases.create', 'support.messages.read', 'support.messages.send'],
    presentation: { title: '服务中心', summary: '消费者与管理员共用一个工作台' },
  }],
} as const satisfies ConsoleModuleManifest<'support'>;
