import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { presentError } from '@shop/presentation';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Listing } from '../model/Product';
import type { ProductDrawerTab } from '../view/ProductDrawerPanels';
import { productDetailKey } from './ProductQueryKey';

export function useProductDrawerViewModel(listing: Listing | undefined, context: ConsoleContext, dependencies: ProductDependencies) {
  const [tab, selectTab] = useState<ProductDrawerTab>('overview');
  const request = { scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) } as const;
  const query = useQuery({ queryKey: productDetailKey(context, listing?.product_id ?? 'closed'), queryFn: ({ signal }) => dependencies.readProduct.execute(request, listing!.product_id, signal), enabled: listing !== undefined, staleTime: 60_000 });
  return Object.freeze({ listing, tab, selectTab, detail: query.data, pending: query.isPending, ...(query.error === null ? {} : { error: presentError(query.error).message }) });
}
