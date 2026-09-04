import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { productViewModel } from './viewmodel/ProductViewModel';

export const ProductManifest = defineMiniappManifest('product', productViewModel, [{ routeid: 'miniappproduct', title: '商品详情', breadcrumbs: ['首页', '选购福利', '商品详情'], load: () => import('./page') }]);
