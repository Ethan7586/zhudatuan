import { useVoucherViewModel } from '../viewmodel/VoucherViewModel';
import { VoucherPage } from '../view/VoucherPage';
export function Component() {
  return <VoucherPage viewmodel={useVoucherViewModel()} />;
}
