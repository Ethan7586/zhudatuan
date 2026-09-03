import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ProductPage } from '../view/ProductPage';
import { useProductViewModel } from '../viewmodel/ProductViewModel';
import '../view/Layout.css';
import '../view/Table.css';
import '../view/Dialogs.css';
import '../view/Drawer.css';
import '../view/DrawerPanels.css';
import '../view/Responsive.css';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const title = useRouteTitle('商品池');
  const viewmodel = useProductViewModel(context, dependencies.product);
  return <ProductPage title={title} viewmodel={viewmodel} />;
}
