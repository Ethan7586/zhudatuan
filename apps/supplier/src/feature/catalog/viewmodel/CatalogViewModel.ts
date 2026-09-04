import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const catalogViewModel = defineSupplierViewModel({ routes: ['suppliercatalog'], title: '商品目录', description: '查看当前供应商范围内的平台商品与投放状态。', read: (client, context) => client.catalog.listingsRead({ query: { limit: 50 } }, context) });
