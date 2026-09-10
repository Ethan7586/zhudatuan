import { OP_CATALOG_PRODUCTS_CREATE } from '@shop/contract/ids';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Listing } from '../model/Product';
import type { ProductAction } from '../model/ProductAction';
import { useProductActionViewModel } from './ProductActionViewModel';
import { productDetailKey } from './ProductQueryKey';
import { productQuery } from './ProductQueryState';
import { useProductPoolViewModel, type PoolMode } from './ProductPoolViewModel';

export function useProductWorkflows(context: ConsoleContext, dependencies: ProductDependencies, requestStepup: () => void, rows: readonly Listing[], limit: number, refresh: () => void, resetPagination: () => void) {
  const client = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [action, setAction] = useState<ProductAction | null>(null);
  const [poolsopen, setPoolsOpen] = useState(false);
  const [poollisting, setPoolListing] = useState<Listing>();
  const [poolintent, setPoolIntent] = useState<PoolMode>();
  const [message, setMessage] = useState<string>();
  const [focusproduct, setFocusProduct] = useState<string>();

  useEffect(() => {
    if (focusproduct === undefined) return;
    const focused = rows.find((item) => item.product_id === focusproduct);
    if (focused === undefined) return;
    setSearch((current) => productQuery.patch(current, { selected: focused.id }));
    setFocusProduct(undefined);
  }, [focusproduct, rows, setSearch]);

  const closeAction = () => setAction(null);
  const actionmodel = useProductActionViewModel(action, context, dependencies, requestStepup, (receipt) => {
    const completed = action;
    const product = productReceipt(receipt);
    const productid = completed !== null && 'listing' in completed && typeof completed.listing.product_id === 'string' ? completed.listing.product_id : product?.id;
    closeAction();
    setMessage(completed?.operation === OP_CATALOG_PRODUCTS_CREATE ? '商品资料已保存，下一步：加入商品池。' : '商品操作已完成，正在更新上架主流程。');
    if (completed?.operation === OP_CATALOG_PRODUCTS_CREATE && product !== undefined) {
      setFocusProduct(product.id);
      resetPagination();
      setSearch(productQuery.patch(search, { q: product.title, category: '', supplier: '', mall: '', status: '', limit, page: 1, cursor: undefined, selected: undefined }));
    } else if (completed !== null && 'listing' in completed) {
      setSearch((current) => productQuery.patch(current, { selected: completed.listing.id }));
    }
    refresh();
    if (productid !== undefined) void client.invalidateQueries({ queryKey: productDetailKey(context, productid) });
  });

  const poolmodel = useProductPoolViewModel(
    poolsopen,
    poollisting,
    context,
    dependencies,
    requestStepup,
    () => {
      const completed = poollisting;
      const completedIntent = poolintent;
      closePools();
      setMessage(poolMessage(completed, completedIntent));
      refresh();
      if (completed !== undefined) setSearch((current) => productQuery.patch(current, { selected: completed.id }));
      if (completed !== undefined && typeof completed.product_id === 'string') void client.invalidateQueries({ queryKey: productDetailKey(context, completed.product_id) });
    },
    poolintent
  );

  function closePools() {
    setPoolsOpen(false);
    setPoolListing(undefined);
    setPoolIntent(undefined);
  }

  return Object.freeze({
    message,
    action: actionmodel,
    pool: poolmodel,
    commands: Object.freeze({
      notify: setMessage,
      openAction: setAction,
      closeAction,
      openPools: (listing?: Listing, intent?: PoolMode) => {
        setPoolListing(listing);
        setPoolIntent(intent);
        setPoolsOpen(true);
      },
      closePools,
    }),
  });
}

function productReceipt(value: unknown): Readonly<{ id: string; title: string }> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Readonly<Record<string, unknown>>;
  return typeof candidate.id === 'string' && typeof candidate.title === 'string' ? Object.freeze({ id: candidate.id, title: candidate.title }) : undefined;
}

function poolMessage(listing: Listing | undefined, intent: PoolMode | undefined): string {
  if (listing === undefined) return '商品池操作已完成';
  return intent === 'deliver' ? '商品池已投放到商城，系统正在检查售价、库存和售卖资格。' : '商品已加入商品池，系统正在检查商城投放与销售条件。';
}
