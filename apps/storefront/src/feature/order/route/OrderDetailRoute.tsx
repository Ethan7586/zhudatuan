import { useParams } from 'react-router';
import { useOrderDetailViewModel } from '../viewmodel/OrderDetailViewModel';
import { OrderDetailPage } from '../view/OrderDetailPage';
import { StorefrontStepup } from '../../security';
import { OrderCancelDialog } from '../view/OrderCancelDialog';
export function Component() {
  const { orderId = '' } = useParams();
  const viewmodel = useOrderDetailViewModel(orderId);
  return <><OrderDetailPage viewmodel={viewmodel} /><OrderCancelDialog viewmodel={viewmodel} /><StorefrontStepup open={viewmodel.verification} onClose={viewmodel.actions.closeVerification} onVerified={viewmodel.actions.verified} /></>;
}
