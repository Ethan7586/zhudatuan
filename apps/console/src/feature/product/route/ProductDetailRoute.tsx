import { useNavigate, useParams } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { ProductDetailPage } from '../view/ProductDetailPage';
import { useProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';
import '../view/DetailPanels.css';
import '../view/DetailWorkspace.css';

export function Component() {
  const productid = useParams().productId ?? '';
  const context = useConsoleContext();
  const dependencies = useDependencies();
  const navigate = useNavigate();
  const viewmodel = useProductDetailViewModel(productid, context, dependencies.product);
  const back = () => void navigate(scopeRoutePath(context.scope, 'consoleproducts'));
  return <ProductDetailPage routeTitle={useRouteTitle('商品详情')} onBack={back} viewmodel={viewmodel} />;
}
