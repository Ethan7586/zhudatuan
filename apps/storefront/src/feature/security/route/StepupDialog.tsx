import { useStepupViewModel } from '../viewmodel/StepupViewModel';
import { StorefrontStepup as StepupView } from '../view/StorefrontStepup';

export function StorefrontStepup(props: Readonly<{ open: boolean; onClose: () => void; onVerified: () => void }>) {
  const viewmodel = useStepupViewModel(props.open, props.onVerified);
  return <StepupView open={props.open} onClose={props.onClose} viewmodel={viewmodel} />;
}
