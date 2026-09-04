import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { useStepup } from '../../../entity/session/StepupContext';
import { OrderDetailPage } from '../view/OrderDetailPage';
import { useOrderDetailViewModel } from '../viewmodel/DetailViewModel';
import { readPageTab, writePageTab } from '../viewmodel/OrderSearch';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import '../view/Layout.css';
import '../view/Controls.css';
import '../view/Table.css';
import '../view/Drawer.css';
import '../view/DrawerPanels.css';
import '../view/Responsive.css';

export function Component() {
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const location = useLocation();
  const navigate = useNavigate();
  const reference = useParams().orderId ?? '';
  const [search, setSearch] = useSearchParams();
  const tab = readPageTab(search);
  const title = useRouteTitle('订单详情');
  const listPath = scopeRoutePath(context.scope, 'consoleorders');
  const candidate = (location.state as { orderReturnTo?: unknown } | null)?.orderReturnTo;
  const returnTo = typeof candidate === 'string' && (candidate === listPath || candidate.startsWith(`${listPath}?`)) ? candidate : listPath;
  return <OrderDetailPage title={title} tab={tab} onTab={(nextTab) => setSearch((current) => writePageTab(current, nextTab), { replace: true })} onBack={() => void navigate(returnTo)} viewmodel={useOrderDetailViewModel(context, dependencies.order, reference, useStepup().request)} />;
}
