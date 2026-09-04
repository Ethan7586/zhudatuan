import { defineSupplierFeature } from '../../../shared/FeatureManifest';

export const connectionManifest = defineSupplierFeature('connection', [{ routeid: 'supplierconnections', title: '连接健康', breadcrumbs: ['供应链后台', '连接健康'], load: () => import('../route/ConnectionRoute') }]);
