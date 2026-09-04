import { useCartViewModel } from '../viewmodel/CartViewModel';
import { CartPage } from '../view/CartPage';
export function Component() {
  return <CartPage viewmodel={useCartViewModel()} />;
}
