import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const pricingViewModel = defineSupplierViewModel({ routes: ['supplierpricing'], title: '价格管理', description: '查看当前供应商报价；生效金额始终以服务端为准。', read: (client, context) => client.pricing.offersRead({ query: {} }, context) });
