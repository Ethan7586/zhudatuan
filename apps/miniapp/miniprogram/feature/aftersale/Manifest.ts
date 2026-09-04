import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { aftersaleViewModel } from './viewmodel/AftersaleViewModel';

export const AftersaleManifest = defineMiniappManifest('aftersale', aftersaleViewModel, [{ routeid: 'miniappaftersale', title: '售后服务', breadcrumbs: ['我的订单', '订单详情', '售后服务'], load: () => import('./page') }]);
