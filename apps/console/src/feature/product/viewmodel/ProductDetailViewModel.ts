import { queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { productDetailKey } from './ProductQueryKey';

export function useProductDetailViewModel(productid: string, context: ConsoleContext, dependencies: ProductDependencies) {
  const request = Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) });
  const query = useQuery({ queryKey: productDetailKey(context, productid), queryFn: ({ signal }) => dependencies.readProduct.execute(request, productid, signal), enabled: productid !== '', staleTime: 60_000 });
  const error = safeQueryError(query.error);
  return Object.freeze({ data: query.data, condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: false }), ...(error === undefined ? {} : { error }), refresh: () => void query.refetch() });
}

export type ProductDetailViewModel = ReturnType<typeof useProductDetailViewModel>;
