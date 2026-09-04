import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const accountViewModel = defineStoreViewModel({ routes: ['storeaccountwork'], title: '员工账户', description: '查看当前员工身份和门店会话资料。', read: (client, context) => client.member.profileRead({}, context) });
