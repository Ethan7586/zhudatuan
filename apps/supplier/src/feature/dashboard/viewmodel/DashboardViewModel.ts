import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const dashboardViewModel = defineSupplierViewModel({ routes: ['suppliertasks'], title: '待办任务', description: '按时效查看需要供应商处理的订单与协同事项。', read: (client, context) => client.order.ordersRead({ query: { limit: 50 } }, context) });
