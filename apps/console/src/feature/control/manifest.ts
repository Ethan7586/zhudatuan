import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const controlModule = {
  id: 'control',
  status: 'enabled',
  navigation: { placement: 'main', group: 'overview', order: 20, label: '主打团中控台', icon: 'control' },
  routes: [{
    id: 'control.index',
    path: 'control',
    kind: 'entry',
    lazy: () => import('./ControlRoute'),
    operations: ['runtime.health.dependency'],
    presentation: { title: '中控台', summary: '系统效率、处理能力和恢复状态' },
  }],
} as const satisfies ConsoleModuleManifest<'control'>;
