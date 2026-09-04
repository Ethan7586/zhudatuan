import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { supportViewModel } from './viewmodel/SupportViewModel';

export const SupportManifest = defineMiniappManifest('support', supportViewModel, [
  { routeid: 'miniappsupport', title: '客服与帮助', breadcrumbs: ['我的', '客服与帮助'], load: () => import('./page') },
  { routeid: 'miniappsupportcase', title: '服务单详情', breadcrumbs: ['客服与帮助', '服务单详情'], load: () => import('./page') },
]);
