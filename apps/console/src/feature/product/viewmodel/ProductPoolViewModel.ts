import { OP_CATALOG_LISTINGS_POOL_SET, OP_CATALOG_POOLS_ALLOCATE, OP_CATALOG_POOLS_ATTACH, OP_CATALOG_POOLS_DETACH, OP_CATALOG_POOLS_READ, OP_ORGANIZATION_LAYERS_READ } from '@shop/contract/ids';
import { presentError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { identityFor, type CommandIdentity } from '../../../shared/action/CommandIdentity';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { Listing, Pool, PoolAllocationKind } from '../model/Product';
import { isManagedListing } from '../model/ProductAction';
import { productCommand } from './ProductCommand';
import { poolKey } from './ProductQueryKey';

export type PoolMode = 'allocate' | 'attach' | 'detach' | 'move' | 'remove' | 'deliver';

export function useProductPoolViewModel(open: boolean, listing: Listing | undefined, context: ConsoleContext, dependencies: ProductDependencies, requestStepup: () => void, onDone: () => void, intent?: PoolMode) {
  const request = { scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) } as const;
  const canRead = canUseOperation(context, OP_CATALOG_POOLS_READ);
  const canMode = (mode: PoolMode): boolean => canUseOperation(context, operationId(mode));
  const globalMode = (['allocate', 'attach', 'detach'] as const).find(canMode) ?? 'allocate';
  const query = useQuery({ queryKey: poolKey(context), queryFn: ({ signal }) => dependencies.readPools.execute(request, signal), enabled: open && canRead, staleTime: 60_000 });
  const pools = query.data?.items ?? [];
  const canReadTargets = canUseOperation(context, OP_ORGANIZATION_LAYERS_READ);
  const needsTargets = listing === undefined || intent === 'deliver';
  const targetQuery = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORGANIZATION_LAYERS_READ, 'productpooltargets'],
    queryFn: ({ signal }) => dependencies.readPoolTargets.execute(context, signal),
    enabled: open && canReadTargets && needsTargets,
    staleTime: 60_000,
  });
  const malls = useMemo(() => mallTargets(context, targetQuery.data ?? context.scopes), [context, targetQuery.data]);
  const [selectedid, select] = useState('');
  const [targetscope, setTarget] = useState('');
  const [kind, setKind] = useState<PoolAllocationKind>('channel');
  const [name, setName] = useState('主打团渠道商品池');
  const [operation, setOperation] = useState<PoolMode>('allocate');
  useEffect(() => {
    if (!open) return;
    select('');
    setOperation(listing === undefined ? globalMode : (intent ?? 'move'));
  }, [globalMode, intent, listing, open]);
  const listingpool = listing !== undefined && isManagedListing(listing) ? listing.pool_id : undefined;
  const options = useMemo(() => selectablePools(pools, operation, context.scope.id, listing), [context.scope.id, listing, operation, pools]);
  const selected =
    operation === 'deliver' && listingpool != null ? pools.find((pool) => pool.id === listingpool) : (options.find((pool) => pool.id === selectedid && pool.id !== listingpool) ?? (listing === undefined ? options[0] : undefined));
  const target = operation === 'allocate' ? context.scope.id : malls.some(({ id }) => id === targetscope) ? targetscope : (malls[0]?.id ?? '');
  const targetName = operation === 'allocate' ? (context.scope.name ?? '当前管理范围') : (malls.find((mall) => mall.id === target)?.name ?? '所选商城');
  const globalOperation = operation === 'allocate' || operation === 'attach' || operation === 'detach';
  const operationAllowed = canRead && canMode(operation);
  const listingManaged = listing !== undefined && isManagedListing(listing);
  const listingManageable = listingManaged && listing.status !== 'published' && listing.status !== 'retired';
  const canSubmit =
    operationAllowed &&
    (listing === undefined
      ? selected !== undefined && globalOperation && target.length > 0 && (operation !== 'allocate' || name.trim().length > 0)
      : operation === 'deliver'
        ? listingManaged && listingpool != null && selected?.id === listingpool && target.length > 0
        : listingManageable && (operation === 'remove' ? listingpool != null : operation === 'move' && selected !== undefined && selected.id !== listingpool));
  const commandidentity = useRef<CommandIdentity | undefined>(undefined);
  const identity = identityFor(commandidentity, JSON.stringify({ listing: listing?.id, version: listing?.version, selected: selected?.id, target, kind, name, operation }), dependencies.createIdentity);
  const mutation = useMutation<unknown>({
    mutationFn: async () => {
      if (!operationAllowed) throw new Error('OPERATION_ACCESS_DENIED');
      if (listing !== undefined) {
        if (!isManagedListing(listing)) throw new Error('LISTING_NOT_PURCHASABLE');
        if (operation === 'deliver') {
          if (selected === undefined || listing.pool_id !== selected.id) throw new Error('请先把商品加入商品池');
          return dependencies.changePool.execute(productCommand(context, identity), selected, { operation: OP_CATALOG_POOLS_ATTACH, target });
        }
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
    onError: (error) => {
      if (operationErrorCode(error) === 'STEPUP_REQUIRED') requestStepup();
    },
  });
  const failure = mutation.error ?? query.error ?? targetQuery.error;
  return Object.freeze({
    open,
    ...(listing === undefined ? {} : { listing }),
    pools,
    options,
    malls,
    ...(selected === undefined ? {} : { selected }),
    target,
    targetName,
    kind,
    name,
    operation,
    guided: listing !== undefined && intent !== undefined,
    canMode,
    canSubmit,
    loading: query.isPending,
    targetsLoading: targetQuery.isPending && targetQuery.isEnabled,
    submitting: mutation.isPending,
    permissionReason: operationAllowed ? undefined : !canRead ? '当前账号没有查看商品池的权限。' : '当前账号不能执行所选商品池操作。',
    ...(failure === null ? {} : { error: presentError(failure).message }),
    select,
    setTarget,
    setKind,
    setName,
    setOperation,
    submit: () => {
      if (!canSubmit || mutation.isPending) return;
      if (context.session.assurance.level < requiredAssurance(operationId(operation))) {
        requestStepup();
        return;
      }
      mutation.mutate();
    },
  });
}

function selectablePools(pools: readonly Pool[], operation: PoolMode, currentScope: string, listing: Listing | undefined): readonly Pool[] {
  if (operation === 'remove' || operation === 'deliver') return Object.freeze([]);
  const targetScope = listing?.scope_id ?? currentScope;
  return Object.freeze(pools.filter((pool) => pool.scope_id === targetScope && pool.status === 'active'));
}

function operationErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object') return undefined;
  const code = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : undefined;
}

function operationId(mode: PoolMode) {
  if (mode === 'allocate') return OP_CATALOG_POOLS_ALLOCATE;
  if (mode === 'attach' || mode === 'deliver') return OP_CATALOG_POOLS_ATTACH;
  if (mode === 'detach') return OP_CATALOG_POOLS_DETACH;
  return OP_CATALOG_LISTINGS_POOL_SET;
}

type PoolTargetSource = Readonly<{ id: string; name?: string | undefined; parent_id?: string | null | undefined; path?: readonly Readonly<{ id: string }>[] | undefined; kind: string }>;
type PoolTarget = Readonly<{ id: string; name: string | undefined; parent: string | null | undefined; path: readonly Readonly<{ id: string }>[] | undefined; kind: string }>;

function mallTargets(context: ConsoleContext, values: readonly PoolTargetSource[]): readonly Readonly<{ id: string; name?: string }>[] {
  const combined = new Map<string, PoolTarget>();
  for (const value of [...values, ...context.scopes, context.scope]) {
    combined.set(value.id, Object.freeze({ id: value.id, kind: value.kind, name: value.name, parent: value.parent_id, path: value.path }));
  }
  return Object.freeze(
    [...combined.values()]
      .filter((scope) => scope.kind === 'mall' && governedBy(context.scope.id, scope, combined))
      .sort((left, right) => (left.name ?? left.id).localeCompare(right.name ?? right.id, 'zh-CN'))
      .map((scope) => Object.freeze({ id: scope.id, ...(scope.name === undefined ? {} : { name: scope.name }) }))
  );
}

function governedBy(current: string, target: PoolTarget, scopes: ReadonlyMap<string, PoolTarget>): boolean {
  if (target.id === current) return true;
  if (target.path?.some((part) => part.id === current) === true) return true;
  const seen = new Set<string>();
  let parent = target.parent;
  while (parent !== undefined && parent !== null && !seen.has(parent)) {
    if (parent === current) return true;
    seen.add(parent);
    parent = scopes.get(parent)?.parent;
  }
  return false;
}

export type ProductPoolViewModel = ReturnType<typeof useProductPoolViewModel>;
