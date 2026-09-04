import { useAccountViewModel } from '../viewmodel/AccountViewModel';
import { AccountPage } from '../view/AccountPage';
export function Component() {
  return <AccountPage viewmodel={useAccountViewModel()} />;
}
