import { useNavigate, useParams } from 'react-router';
import { routePath } from '../../../generated/RouteBinding';
import { usePaymentViewModel } from '../viewmodel/PaymentViewModel';
import { PaymentResultPage } from '../view/PaymentResultPage';
export function Component() {
  const navigate = useNavigate();
  const { paymentId = '' } = useParams();
  return <PaymentResultPage viewmodel={usePaymentViewModel(paymentId)} openOrder={(id) => void navigate(routePath('storeorder', { orderId: id }))} />;
}
