import { useParams } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { OrderDetailPage } from '../view/OrderDetailPage';
import { useOrderDetailViewModel } from '../viewmodel/DetailViewModel';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const reference = useParams().orderId ?? '';
  const title = useRouteTitle('订单管理');
  return <OrderDetailPage title={title} viewmodel={useOrderDetailViewModel(context, dependencies.order, reference)} />;
}
