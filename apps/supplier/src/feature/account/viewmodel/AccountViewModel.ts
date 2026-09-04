import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';
export const accountViewModel = defineSupplierViewModel({ routes: ['supplieraccount'], title: '供应商账户', description: '查看当前人员身份和供应商会话资料。', read: (client, context) => client.member.profileRead({}, context) });
