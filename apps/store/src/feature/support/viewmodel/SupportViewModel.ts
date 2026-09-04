import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const supportViewModel = defineStoreViewModel({ routes: ['storesupportwork'], title: '客服协同', description: '查看与当前门店相关的客服工单和处理状态。', read: (client, context) => client.support.casesRead({ query: { limit: 50 } }, context) });
