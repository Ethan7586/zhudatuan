import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const controlModule = {
  id: 'control',
  status: 'enabled',
  navigation: { placement: 'main', group: 'overview', order: 20, label: '商家服务中心', icon: 'control', scopeKinds: ['platform'] },
  routes: [{
    id: 'control.index',
    path: 'control',
    kind: 'entry',
    lazy: () => import('./ControlRoute'),
    operations: ['runtime.health.dependency'],
    presentation: { title: '商家服务中心', summary: '为商家开通独立品牌、域名、渠道与商城体系' },
  }],
} as const satisfies ConsoleModuleManifest<'control'>;
