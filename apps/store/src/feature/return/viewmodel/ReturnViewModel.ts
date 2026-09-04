import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const returnViewModel = defineStoreViewModel({ routes: ['storereturnwork'], title: '退货检验', description: '查看售后申请，并按服务端状态进入收货和检验流程。', read: (client, context) => client.order.aftersalesRead({ query: { limit: 50 } }, context) });
