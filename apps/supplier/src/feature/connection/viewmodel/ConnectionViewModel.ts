import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const connectionViewModel = defineSupplierViewModel({ routes: ['supplierconnections'], title: '连接健康', description: '查看供应商接口连接和最近健康状态。', read: (client, context) => client.channel.connectionsRead({ query: { limit: 50 } }, context) });
