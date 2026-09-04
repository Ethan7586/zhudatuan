import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const vouchersModule = {
  id: 'vouchers',
  status: 'enabled',
  navigation: { placement: 'main', group: 'commerce', order: 80, label: '卡券治理台', icon: 'voucher' },
  routes: [
    {
      id: 'vouchers.index',
      path: 'vouchers',
      kind: 'entry',
      lazy: () => import('./VoucherRoute'),
      operations: ['voucher.cardlibraries.read', 'voucher.programs.read', 'voucher.reserves.read', 'voucher.batches.read'],
      presentation: { title: '卡券治理台', summary: '按当前网站范围管理卡券方案、卡号库、备券申请与发行批次' },
    },
    {
      id: 'vouchers.import',
      path: 'imports/voucher/:jobId',
      kind: 'technical',
      lazy: () => import('../importing/ImportRoute'),
      operations: ['voucher.imports.read'],
      presentation: { title: '导入结果', summary: '导入进度、错误行和服务端报告' },
    },
  ],
} as const satisfies ConsoleModuleManifest<'vouchers'>;
