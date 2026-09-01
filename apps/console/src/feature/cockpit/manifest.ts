import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const cockpitModule = {
  id: 'cockpit',
  status: 'enabled',
  navigation: { placement: 'main', group: 'overview', order: 10, label: '经营驾驶舱', icon: 'trend' },
  routes: [{
    id: 'cockpit.index',
    path: 'cockpit',
    kind: 'entry',
    lazy: () => import('./CockpitRoute'),
    operations: ['reporting.dashboard.read'],
    presentation: { title: '经营驾驶舱', summary: '经营数据、宏观和细节趋势' },
  }],
} as const satisfies ConsoleModuleManifest<'cockpit'>;
