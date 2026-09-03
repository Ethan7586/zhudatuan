import { useParams } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { useRouteTitle } from '../../../shared/ui/RouteTitle';
import { ProductDetailPage } from '../view/ProductDetailPage';
import { useProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';

export function Component() {
  const productid = useParams().productId ?? '';
  const context = useConsoleContext();
  const dependencies = useDependencies();
  return <ProductDetailPage routeTitle={useRouteTitle('商品池')} viewmodel={useProductDetailViewModel(productid, context, dependencies.product)} />;
}
