import { OP_CATALOG_LISTINGS_POOL_SET, OP_CATALOG_POOLS_ALLOCATE, OP_CATALOG_POOLS_ATTACH, OP_CATALOG_POOLS_DETACH, OP_CATALOG_POOLS_READ } from '@shop/contract/ids';
import { presentError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { identityFor, type CommandIdentity } from '../../../shared/action/CommandIdentity';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import type { Listing, PoolAllocationKind } from '../model/Product';
import { isManagedListing } from '../model/ProductAction';
import { productCommand } from './ProductCommand';
import { poolKey } from './ProductQueryKey';

type PoolMode = 'allocate' | 'attach' | 'detach' | 'move' | 'remove';

export function useProductPoolViewModel(open: boolean, listing: Listing | undefined, context: ConsoleContext, dependencies: ProductDependencies, onDone: () => void) {
  const request = { scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) } as const;
  const canRead = canUseOperation(context, OP_CATALOG_POOLS_READ);
  const canMode = (mode: PoolMode): boolean => canUseOperation(context, operationId(mode));
  const globalMode = (['allocate', 'attach', 'detach'] as const).find(canMode) ?? 'allocate';
  const query = useQuery({ queryKey: poolKey(context), queryFn: ({ signal }) => dependencies.readPools.execute(request, signal), enabled: open && canRead, staleTime: 60_000 });
  const pools = query.data?.items ?? [];
  const malls = useMemo(() => {
    const visible = context.scopes.filter((scope) => scope.kind === 'mall' && visibleMall(context, scope)).map((scope) => Object.freeze({ id: scope.id, name: scope.name }));
    return visible.length === 0 ? [Object.freeze({ id: context.scope.id, name: context.scope.name })] : visible;
  }, [context]);
  const [selectedid, select] = useState('');
  const [targetscope, setTarget] = useState('');
  const [kind, setKind] = useState<PoolAllocationKind>('channel');
  const [name, setName] = useState('主打团渠道商品池');
  const [operation, setOperation] = useState<PoolMode>('allocate');
  useEffect(() => {
    if (!open) return;
    select(listing !== undefined && isManagedListing(listing) ? (listing.pool_id ?? '') : '');
    setOperation(listing === undefined ? globalMode : 'move');
  }, [globalMode, listing, open]);
  const listingpool = listing !== undefined && isManagedListing(listing) ? listing.pool_id : undefined;
  const selected = pools.find((pool) => pool.id === selectedid) ?? (listing === undefined ? pools[0] : pools.find((pool) => pool.id !== listingpool));
  const target = targetscope || malls[0]?.id || context.scope.id;
  const globalOperation = operation === 'allocate' || operation === 'attach' || operation === 'detach';
  const operationAllowed = canRead && canMode(operation);
  const listingManageable = listing !== undefined && isManagedListing(listing) && listing.status !== 'published' && listing.status !== 'retired';
  const canSubmit =
    operationAllowed &&
    (listing === undefined ? selected !== undefined && globalOperation : listingManageable && (operation === 'remove' ? listingpool != null : operation === 'move' && selected !== undefined && selected.id !== listingpool));
  const commandidentity = useRef<CommandIdentity | undefined>(undefined);
  const identity = identityFor(commandidentity, JSON.stringify({ listing: listing?.id, version: listing?.version, selected: selected?.id, target, kind, name, operation }), dependencies.createIdentity);
  const mutation = useMutation<unknown>({
    mutationFn: async () => {
      if (!operationAllowed) throw new Error('OPERATION_ACCESS_DENIED');
      if (listing !== undefined) {
        if (!isManagedListing(listing)) throw new Error('LISTING_NOT_PURCHASABLE');
        if (operation === 'remove') return dependencies.changePool.move(productCommand(context, identity), listing, null);
        if (selected === undefined) throw new Error('请先选择目标商品池');
        return dependencies.changePool.move(productCommand(context, identity), listing, selected);
      }
      if (selected === undefined) throw new Error('请先选择来源商品池');
      if (!globalOperation) throw new Error('请选择商品池管理操作');
      const change =
        operation === 'allocate' ? ({ operation: OP_CATALOG_POOLS_ALLOCATE, target, poolkind: kind, name } as const) : ({ operation: operation === 'attach' ? OP_CATALOG_POOLS_ATTACH : OP_CATALOG_POOLS_DETACH, target } as const);
      return dependencies.changePool.execute(productCommand(context, identity), selected, change);
    },
    onSuccess: () => {
      void query.refetch();
      onDone();
    },
  });
  const failure = mutation.error ?? query.error;
  return Object.freeze({
    open,
    ...(listing === undefined ? {} : { listing }),
    pools,
    malls,
    ...(selected === undefined ? {} : { selected }),
    target,
    kind,
    name,
    operation,
    canMode,
    canSubmit,
    loading: query.isPending,
    submitting: mutation.isPending,
    permissionReason: operationAllowed ? undefined : !canRead ? '当前账号没有查看商品池的权限。' : '当前账号不能执行所选商品池操作。',
    ...(failure === null ? {} : { error: presentError(failure).message }),
    select,
    setTarget,
    setKind,
    setName,
    setOperation,
    submit: () => {
      if (canSubmit && !mutation.isPending) mutation.mutate();
    },
  });
}

function operationId(mode: PoolMode) {
  if (mode === 'allocate') return OP_CATALOG_POOLS_ALLOCATE;
  if (mode === 'attach') return OP_CATALOG_POOLS_ATTACH;
  if (mode === 'detach') return OP_CATALOG_POOLS_DETACH;
  return OP_CATALOG_LISTINGS_POOL_SET;
}

function visibleMall(context: ConsoleContext, scope: ConsoleContext['scopes'][number]): boolean {
  if (context.scope.kind === 'platform' || scope.id === context.scope.id) return true;
  return scope.path?.some((part) => part.id === context.scope.id) === true;
}

export type ProductPoolViewModel = ReturnType<typeof useProductPoolViewModel>;
