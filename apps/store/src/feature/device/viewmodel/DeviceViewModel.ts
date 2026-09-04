import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
export const deviceViewModel = defineStoreViewModel({ routes: ['storedevices'], title: '设备与人员', description: '查看当前门店已登记设备及可信状态。', read: (client, context) => client.verification.devicesRead({ query: { limit: 50 } }, context) });
