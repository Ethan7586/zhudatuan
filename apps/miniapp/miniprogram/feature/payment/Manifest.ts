import { defineMiniappManifest } from '../../shared/FeatureManifest';
import { paymentViewModel } from './viewmodel/PaymentViewModel';

export const PaymentManifest = defineMiniappManifest('payment', paymentViewModel, [{ routeid: 'miniapppayment', title: '支付结果', breadcrumbs: ['我的订单', '支付结果'], load: () => import('./page') }]);
