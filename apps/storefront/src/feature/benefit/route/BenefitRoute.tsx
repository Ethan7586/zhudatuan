import { useBenefitViewModel } from '../viewmodel/BenefitViewModel';
import { BenefitPage } from '../view/BenefitPage';
export function Component() {
  return <BenefitPage viewmodel={useBenefitViewModel()} />;
}
