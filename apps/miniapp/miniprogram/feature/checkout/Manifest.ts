import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { checkoutViewModel } from './viewmodel/CheckoutViewModel';

export const CheckoutManifest = defineMiniappManifest('checkout', checkoutViewModel, [{ routeid: 'miniappcheckout', title: '确认订单', breadcrumbs: ['购物车', '确认订单'], load: () => import('./page') }]);
