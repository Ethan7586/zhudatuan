import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const reportsModule = {
  id: 'reports',
  status: 'enabled',
  navigation: { placement: 'main', group: 'overview', order: 15, label: '数据报表', icon: 'trend' },
  routes: [{
    id: 'reports.index',
    path: 'reports',
    kind: 'entry',
    lazy: () => import('./ReportRoute'),
    operations: [
      'reporting.sales.read',
      'reporting.products.read',
      'reporting.malls.read',
      'reporting.categories.read',
      'reporting.channels.read',
      'reporting.powderclass.read',
      'reporting.voucherconsumption.read',
    ],
    presentation: { title: '数据报表', summary: '商品、商城、分类、渠道和卡券投影' },
  }],
} as const satisfies ConsoleModuleManifest<'reports'>;
