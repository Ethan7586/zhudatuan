import { useRef, useState, type SetStateAction } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { routePath, ROUTES } from '../../../generated/RouteBinding';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import { presentProduct, selectProductSku, type Product } from '../../../entity/product';
import { useAccountIdentity } from '../../account';
import { useCartCommand } from '../../cart';
import { ReadProduct } from '../application/ReadProduct';
import { ShareProduct } from '../application/ShareProduct';
import { useDependencies } from '../../../app/DependencyContext';
import { ReferralShare } from '../../referral';
import { presentError } from '@shop/presentation';

export function useProductViewModel(routeId: string | null = null) {
  const session = useSession();
  const dependencies = useDependencies();
  const identity = useAccountIdentity();
  const cart = useCartCommand();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const reader = useRef(new ReadProduct(dependencies.product));
  const share = useRef(new ShareProduct(dependencies.share));
  const referralShare = useRef(new ReferralShare(dependencies.referral));
  const quickId = search.get('quickview');
  const activeId = quickId ?? routeId;
  const [quantity, setQuantity] = useState(1);
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [tab, setTab] = useState<'detail' | 'spec' | 'aftersale'>('detail');
  const query = useQuery({
    queryKey: StorefrontQuery.product(session.query.public, activeId ?? 'none'),
    queryFn: ({ signal }) => reader.current.execute(activeId!, signal),
    enabled: Boolean(session.scope && activeId),
  });
  const current = query.data ?? null;
  const selected = current ? selectProductSku(current, selectedSkuId) : null;
  const presented = selected ? presentProduct(selected) : null;
  const setQuickViewProduct = (value: SetStateAction<Product | null>) => {
    const product = typeof value === 'function' ? value(selected) : value;
    const next = new URLSearchParams(search);
    if (product) next.set('quickview', product.productId);
    else next.delete('quickview');
    setSearch(next, { replace: true });
  };
  return Object.freeze({
    user: identity.user,
    addresses: identity.addresses,
    state: query.isPending ? ('loading' as const) : query.isError ? ('failed' as const) : current ? ('ready' as const) : ('empty' as const),
    product: presented,
    presentationProducts: presented ? Object.freeze([presented]) : Object.freeze([]),
    quickViewProduct: quickId ? presented : null,
    setQuickViewProduct,
    addToCart: cart.add,
    favorites: identity.favorites,
    toggleFavorite: identity.toggleFavorite,
    shareProduct: async (product: Product) => {
      try {
        const prepared = await referralShare.current.execute(session.session, product.productId, routePath('storeproduct', { productId: product.productId }));
        const result = await share.current.execute(product, prepared.url);
        session.showToast(`${result === 'shared' ? '商品已分享' : '商品链接已复制'}${prepared.attributed ? '，推荐收益将按规则结算' : ''}`, 'success');
      } catch (cause) {
        session.showToast(presentError(cause).message, 'error');
      }
    },
    showToast: session.showToast,
    quantity,
    selectedSkuId: presented?.skuId ?? '',
    tab,
    actions: Object.freeze({
      changeQuantity: (value: number) => setQuantity(Math.max(1, Math.min(selected?.stock ?? 1, value))),
      selectSku: (skuId: string) => {
        setSelectedSkuId(skuId);
        setQuantity(1);
      },
      selectTab: setTab,
      add: () => selected && void cart.add(selected, quantity),
      buy: () => {
        if (!selected) return;
        void cart.add(selected, quantity);
        void navigate(ROUTES.storecart);
      },
      closeQuickView: () => setQuickViewProduct(null),
      addQuickView: (value: number) => {
        if (!selected) return;
        cart.add(selected, value);
        setQuickViewProduct(null);
      },
      buyQuickView: (value: number) => {
        if (!selected) return;
        cart.add(selected, value);
        setQuickViewProduct(null);
        void navigate(ROUTES.storecart);
      },
      back: () => void navigate(ROUTES.storecatalog),
      retry: () => void query.refetch(),
    }),
  });
}
