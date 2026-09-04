import { defineStoreFeature } from '../../../shared/FeatureManifest';

export const deviceManifest = defineStoreFeature('device', [{ routeid: 'storedevices', title: '设备与人员', breadcrumbs: ['门店工作台', '设备与人员'], load: () => import('../route/DeviceRoute') }]);
