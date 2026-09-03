import { useCheckoutViewModel } from '../viewmodel/CheckoutViewModel';
import { CheckoutPage } from '../view/CheckoutPage';
export function Component() { return <CheckoutPage viewmodel={useCheckoutViewModel()} />; }
