import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const productsModule = {
  id: 'products',
  status: 'enabled',
  navigation: { placement: 'main', group: 'commerce', order: 40, label: '商品管理', icon: 'products' },
  routes: [
    {
      id: 'products.index',
      path: 'products',
      kind: 'entry',
      lazy: () => import('./ProductRoute'),
      operations: ['catalog.listings.read', 'catalog.imports.create', 'catalog.imports.read',
        'catalog.listings.publish', 'catalog.listings.unpublish', 'catalog.listings.batch'],
      presentation: { title: '商品管理', summary: '商品数量、SKU、审核与上下架状态' },
    },
    {
      id: 'products.detail',
      path: 'products/:productId',
      kind: 'detail',
      lazy: () => import('./ProductDetailRoute'),
      operations: [],
      presentation: { title: '商品详情', summary: '单商品权威详情' },
      blocker: '缺少 catalog.product.detail.read Operation，页面必须 fail-closed。',
    },
    {
      id: 'products.catalog-import',
      path: 'imports/catalog/:jobId',
      kind: 'technical',
      lazy: () => import('./ProductImportRoute'),
      operations: ['catalog.imports.read', 'catalog.imports.create'],
      presentation: { title: '导入结果', summary: '导入进度、错误行和服务端报告' },
    },
  ],
} as const satisfies ConsoleModuleManifest<'products'>;
