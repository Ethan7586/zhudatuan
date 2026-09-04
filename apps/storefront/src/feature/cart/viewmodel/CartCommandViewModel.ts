import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import type { Product } from '../../../entity/product';
import { ReadCart } from '../application/ReadCart';
import { ChangeCart } from '../application/ChangeCart';
import { useDependencies } from '../../../app/DependencyContext';

export function useCartCommand() {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const command = useRef(new ChangeCart(dependencies.cart));
  const reader = useRef(new ReadCart(dependencies.cart));
  const access = useMemo(() => Object.freeze({ session: session.session, csrfToken: session.csrfToken }), [session.csrfToken, session.session]);
  const cart = useQuery({
    queryKey: StorefrontQuery.cart(session.query.scoped),
    queryFn: ({ signal }) => reader.current.execute(access, signal),
    enabled: session.status === 'authenticated' || (session.status === 'guest' && Boolean(session.scope)),
  });

  useEffect(() => {
    if (cart.data?.merge === 'completed') session.showToast('登录前选择的商品已合并到购物车', 'success');
    if (cart.data?.merge === 'blocked') session.showToast('登录前购物车商品过多，暂未合并；请先整理当前购物车', 'error');
  }, [cart.data?.merge, session.showToast]);

  const refresh = () => client.invalidateQueries({ queryKey: StorefrontQuery.cart(session.query.scoped) });
  const change = async (listingId: string, quantity: number, lineVersion: number | null, selected?: boolean) => {
    await command.current.execute(access, { listingId, quantity, lineVersion, ...(selected === undefined ? {} : { selected }), cartVersion: Number(cart.data?.version ?? 0) });
    await refresh();
  };
  const batch = async (items: readonly Readonly<{ listingId: string; quantity: number; lineVersion: number | null; selected?: boolean }>[]) => {
    await command.current.batch(access, Number(cart.data?.version ?? 0), items);
    await refresh();
  };
  const add = (product: Product, quantity = 1, _selectedSpec: Readonly<Record<string, string>> = {}) => {
    const current = cart.data?.items.find(({ listing, sku }) => listing === product.id && sku === product.skuId);
    const nextQuantity = Number(current?.quantity ?? 0) + quantity;
    if (!product.purchasable || product.stock < nextQuantity || !Number.isSafeInteger(quantity) || quantity < 1) {
      session.showToast('商品当前不可购买，请刷新商品信息后重试', 'error');
      return;
    }
    void change(product.id, nextQuantity, current ? Number(current.version) : null)
      .then(() => session.showToast('已加入购物车', 'success'))
      .catch(() => session.showToast('购物车更新失败，请刷新后重试', 'error'));
  };

  return Object.freeze({ cart: cart.data, state: cart.isError ? ('error' as const) : cart.isPending ? ('loading' as const) : ('ready' as const), refresh: () => void refresh(), add, change, batch });
}
