import { useNavigate } from 'react-router';
import { routePath, ROUTES } from '../../../generated/RouteBinding';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { pathForFeature, pathForPage } from '../../../shared/navigation/Route';
import { useAccountIdentity } from '../../account';
import { useCartCommand } from '../../cart';
import { useCatalogState } from '../../catalog';
import { useOrderState } from '../../order';
import { experienceActionPath } from '../../../shared/navigation/ExperiencePath';
import type { ExperienceAction } from '@shop/contract';

export function useHomeViewModel() {
  const session = useSession();
  const navigate = useNavigate();
  const identity = useAccountIdentity();
  const catalog = useCatalogState();
  const cart = useCartCommand();
  const order = useOrderState(identity.currentMall);
  return Object.freeze({
    user: identity.user,
    profileState: identity.profileState,
    profileMessage: identity.profileMessage,
    retryProfile: identity.retryProfile,
    currentMall: identity.currentMall,
    presentationProducts: catalog.presentationProducts,
    presentationCategories: catalog.presentationCategories,
    catalogState: catalog.state,
    orders: order.orders,
    orderState: order.listState,
    addToCart: (product: Parameters<typeof cart.add>[0], quantity: Parameters<typeof cart.add>[1] = 1) => {
      void cart.add(product, quantity);
    },
    experience: session.experience,
    navigateAction: (action: ExperienceAction) => {
      const path = session.experience ? experienceActionPath(session.experience, action) : null;
      if (path) void navigate(path);
      else session.showToast('当前装修入口无效，请联系商城管理员修复后重试。', 'error');
    },
    navigatePage: (page: Parameters<typeof pathForPage>[0]) => {
      void navigate(pathForPage(page));
    },
    showToast: session.showToast,
    openFeature: (name: string) => {
      void navigate(pathForFeature(name));
    },
    openProduct: (id: string) => void navigate(routePath('storeproduct', { productId: id })),
    openCategory: (id: string) => void navigate(`${ROUTES.storecatalog}?category=${encodeURIComponent(id)}`),
  });
}
