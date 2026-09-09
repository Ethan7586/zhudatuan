import { StorefrontStepup } from '../../security';
import { MemberCodePage } from '../view/MemberCodePage';
import { useMemberCodeViewModel } from '../viewmodel/MemberCodeViewModel';

export function Component() {
  const viewmodel = useMemberCodeViewModel();
  return (
    <>
      <MemberCodePage viewmodel={viewmodel} />
      <StorefrontStepup open={viewmodel.verification} onClose={viewmodel.actions.closeVerification} onVerified={viewmodel.actions.verified} />
    </>
  );
}
