import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { cartViewModel } from './viewmodel/CartViewModel';

export const CartManifest = defineMiniappManifest('cart', cartViewModel, [{ routeid: 'miniappcart', title: '购物车', breadcrumbs: ['首页', '购物车'], load: () => import('./page') }]);
