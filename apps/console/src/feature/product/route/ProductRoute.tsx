import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { useStepup } from '../../../entity/session/StepupContext';
import { ProductPage } from '../view/ProductPage';
import { useProductViewModel } from '../viewmodel/ProductViewModel';
import { useProductImportViewModel } from '../viewmodel/ProductImportViewModel';
import { useProductStockViewModel } from '../viewmodel/ProductStockViewModel';
import '../view/Layout.css';
import '../view/Table.css';
import '../view/Pagination.css';
import '../view/Dialogs.css';
import '../view/Drawer.css';
import '../view/DrawerBlocker.css';
import '../view/DrawerPanels.css';
import '../view/DrawerActions.css';
import '../view/DetailPanels.css';
import '../view/Toolbar.css';
import '../view/ProductImport.css';
import '../view/ProductBatch.css';
import '../view/ProductStock.css';
import '../view/Responsive.css';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const title = useRouteTitle('商品池');
  const requestStepup = useStepup().request;
  const viewmodel = useProductViewModel(context, dependencies.product, requestStepup);
  const importmodel = useProductImportViewModel(context, dependencies.product, requestStepup);
  const stockmodel = useProductStockViewModel(context, dependencies.product, requestStepup, () => viewmodel.resource.refresh());
  return <ProductPage title={title} viewmodel={viewmodel} importmodel={importmodel} stockmodel={stockmodel} />;
}
