import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const verificationViewModel = defineStoreViewModel({ routes: ['storeverification'], title: '扫码核销', description: '核对最近核销结果；正式确认始终由服务端防重放。', read: (client, context) => client.verification.historyRead({ query: { limit: 50 } }, context) });
