import { useParams } from 'react-router';
import { useOrderDetailViewModel } from '../viewmodel/OrderDetailViewModel';
import { OrderDetailPage } from '../view/OrderDetailPage';
export function Component() {
  const { orderId = '' } = useParams();
  return <OrderDetailPage viewmodel={useOrderDetailViewModel(orderId)} />;
}
