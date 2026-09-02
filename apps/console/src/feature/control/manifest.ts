import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const controlModule = {
  id: 'control',
  status: 'enabled',
  navigation: { placement: 'main', group: 'overview', order: 20, label: '商家管理', icon: 'control' },
  routes: [{
    id: 'control.index',
    path: 'control',
    kind: 'entry',
    lazy: () => import('./ControlRoute'),
    operations: ['runtime.health.dependency'],
    presentation: { title: '商家管理', summary: '开通和管理独立品牌、域名、渠道与商城体系' },
  }],
} as const satisfies ConsoleModuleManifest<'control'>;
