import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const supportModule = {
  id: 'support',
  status: 'enabled',
  navigation: { placement: 'bottom', group: 'organization', order: 130, label: '客服系统', icon: 'support' },
  routes: [{
    id: 'support.index',
    path: 'support/:caseId?',
    kind: 'entry',
    lazy: () => import('./SupportRoute'),
    operations: ['support.cases.read', 'support.messages.read', 'support.messages.send'],
    presentation: { title: '客服中心', summary: '工单、对话、分派和 SLA 状态' },
  }],
} as const satisfies ConsoleModuleManifest<'support'>;
