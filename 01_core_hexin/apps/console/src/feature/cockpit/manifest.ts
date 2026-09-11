import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';
import { CockpitBootstrapRoute } from './CockpitBootstrapRoute';

export const cockpitModule = {
  id: 'cockpit',
  status: 'enabled',
  navigation: { placement: 'main', group: 'overview', order: 10, label: '生意看板', icon: 'trend' },
  routes: [{
    id: 'cockpit.index',
    path: 'cockpit',
    kind: 'entry',
    lazy: async () => ({ Component: CockpitBootstrapRoute }),
    operations: ['reporting.dashboard.read'],
    presentation: { title: '生意看板', summary: '销售结果、经营趋势与待办事项' },
  }],
} as const satisfies ConsoleModuleManifest<'cockpit'>;
