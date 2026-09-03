import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { OrderPage } from '../view/OrderPage';
import { useOrderListViewModel } from '../viewmodel/ListViewModel';
import '../view/Layout.css';
import '../view/Controls.css';
import '../view/Table.css';
import '../view/Drawer.css';
import '../view/DrawerPanels.css';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const title = useRouteTitle('订单管理');
  return <OrderPage title={title} viewmodel={useOrderListViewModel(context, dependencies.order)} />;
}
