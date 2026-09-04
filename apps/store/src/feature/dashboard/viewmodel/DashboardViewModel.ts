import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const dashboardViewModel = defineStoreViewModel({ routes: ['storetasks'], title: '今日任务', description: '按异常和时效查看当前门店最需要处理的订单。', read: (client, context) => client.order.ordersRead({ query: { limit: 50 } }, context) });
