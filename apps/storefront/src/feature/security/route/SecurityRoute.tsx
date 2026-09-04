import { SecurityPage } from '../view/SecurityPage';
import { useSecurityViewModel } from '../viewmodel/SecurityViewModel';
export function Component() {
  return <SecurityPage viewmodel={useSecurityViewModel()} />;
}
