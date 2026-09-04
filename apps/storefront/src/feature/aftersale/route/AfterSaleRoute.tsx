import { useParams } from 'react-router';
import { AfterSalePage } from '../view/AfterSalePage';
import { useAfterSaleViewModel } from '../viewmodel/AfterSaleViewModel';
import { StorefrontStepup } from '../../security';
export function Component() {
  const { orderId = '' } = useParams();
  const viewmodel = useAfterSaleViewModel(orderId);
  return (
    <>
      <AfterSalePage viewmodel={viewmodel} />
      <StorefrontStepup open={viewmodel.verification} onClose={viewmodel.actions.closeVerification} onVerified={viewmodel.actions.verified} />
    </>
  );
}
