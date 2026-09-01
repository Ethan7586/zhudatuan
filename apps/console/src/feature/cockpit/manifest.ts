import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';
import { CockpitBootstrapRoute } from './CockpitBootstrapRoute';

export const cockpitModule = {
  id: 'cockpit',
  status: 'enabled',
  navigation: { placement: 'main', group: 'overview', order: 10, label: '经营驾驶舱', icon: 'trend' },
  routes: [{
    id: 'cockpit.index',
    path: 'cockpit',
    kind: 'entry',
    lazy: async () => ({ Component: CockpitBootstrapRoute }),
    operations: ['reporting.dashboard.read'],
    presentation: { title: '经营驾驶舱', summary: '经营数据、宏观和细节趋势' },
  }],
} as const satisfies ConsoleModuleManifest<'cockpit'>;
