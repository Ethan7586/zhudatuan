import { useNavigate, useSearchParams } from 'react-router';
import { routePath, ROUTES } from '../../../generated/RouteBinding';
import { useCatalogState } from '../../catalog';
import { useAccountIdentity } from './AccountIdentityViewModel';
import { useReferralViewModel } from '../../referral';

export function useAccountViewModel() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const identity = useAccountIdentity();
  const section = search.get('section');
  const referral = useReferralViewModel(section === 'referral');
  const listingIds = identity.favoriteItems.filter((item) => item.available).map((item) => item.listingId);
  const catalog = useCatalogState({ listingIds, limit: 100 }, section === 'favorites' && identity.favoriteState === 'ready' && listingIds.length > 0);
  const select = (value: string | null) => {
    const next = new URLSearchParams(search);
    if (value) next.set('section', value);
    else next.delete('section');
    setSearch(next);
  };
  return Object.freeze({
    ...identity,
    presentationProducts: catalog.presentationProducts,
    favoriteCatalogState: listingIds.length === 0 ? ('ready' as const) : catalog.state,
    favoriteCatalogMessage: catalog.state === 'error' ? '收藏商品信息加载失败，请重试' : null,
    section,
    referral,
    actions: Object.freeze({
      profile: () => select(null),
      addresses: () => select('addresses'),
      favorites: () => select('favorites'),
      referral: () => select('referral'),
      benefits: () => void navigate(ROUTES.storebenefits),
      vouchers: () => void navigate(ROUTES.storevouchers),
      orders: () => void navigate(ROUTES.storeorders),
      invoices: () => void navigate(`${ROUTES.storeorders}?view=invoices`),
      notifications: () => void navigate(ROUTES.storenotifications),
      security: () => void navigate(ROUTES.storesecurity),
      support: () => void navigate(ROUTES.storesupport),
      openProduct: (id: string) => void navigate(routePath('storeproduct', { productId: id })),
      retryFavoriteCatalog: catalog.refresh,
    }),
  });
}
