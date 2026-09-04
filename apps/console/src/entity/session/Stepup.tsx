import { StepupDialog } from './view/StepupDialog';
import { useStepupViewModel, type StepupInput } from './viewmodel/StepupViewModel';

export function Stepup(input: StepupInput) {
  return <StepupDialog model={useStepupViewModel(input)} />;
}
