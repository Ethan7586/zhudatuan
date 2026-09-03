import { presentError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Pool } from '../model/Product';
import { command } from './ProductActionViewModel';
import { poolKey } from './ProductQueryKey';

export interface ProductPoolViewModel {
  readonly open: boolean;
  readonly pools: readonly Pool[];
  readonly malls: readonly Readonly<{ id: string; name?: string | undefined }>[];
  readonly selected?: Pool;
  readonly target: string;
  readonly kind: 'channel' | 'markup';
  readonly name: string;
  readonly operation: 'allocate' | 'attach' | 'detach';
  readonly loading: boolean;
  readonly submitting: boolean;
  readonly error?: string;
  readonly select: (value: string) => void;
  readonly setTarget: (value: string) => void;
  readonly setKind: (value: ProductPoolViewModel['kind']) => void;
  readonly setName: (value: string) => void;
  readonly setOperation: (value: ProductPoolViewModel['operation']) => void;
  readonly submit: () => void;
}

export function useProductPoolViewModel(open: boolean, context: ConsoleContext, dependencies: ProductDependencies, onDone: () => void): ProductPoolViewModel {
  const request = { scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) } as const;
  const query = useQuery({ queryKey: poolKey(context), queryFn: ({ signal }) => dependencies.readPools.execute(request, signal), enabled: open, staleTime: 60_000 });
  const pools = query.data?.items ?? [];
  const malls = useMemo(() => {
    const visible = context.scopes.filter((scope) => scope.kind === 'mall' && visibleMall(context, scope)).map((scope) => Object.freeze({ id: scope.id, name: scope.name }));
    return visible.length === 0 ? [Object.freeze({ id: context.scope.id, name: context.scope.name })] : visible;
  }, [context]);
  const [selectedid, select] = useState('');
  const [targetscope, setTarget] = useState('');
  const [kind, setKind] = useState<ProductPoolViewModel['kind']>('channel');
  const [name, setName] = useState('主打团渠道商品池');
  const [operation, setOperation] = useState<ProductPoolViewModel['operation']>('allocate');
  const selected = pools.find((pool) => pool.id === selectedid) ?? pools[0];
  const target = targetscope || malls[0]?.id || context.scope.id;
  const mutation = useMutation({ mutationFn: () => {
    if (selected === undefined) throw new Error('请先选择来源商品池');
    const change = operation === 'allocate' ? { kind: operation, target, poolkind: kind, name } as const : { kind: operation, target } as const;
    return dependencies.changePool.execute(command(context), selected, change);
  }, onSuccess: () => { void query.refetch(); onDone(); } });
  const failure = mutation.error ?? query.error;
  return Object.freeze({ open, pools, malls, ...(selected === undefined ? {} : { selected }), target, kind, name, operation, loading: query.isPending, submitting: mutation.isPending, ...(failure === null ? {} : { error: presentError(failure).message }), select, setTarget, setKind, setName, setOperation, submit: () => { if (!mutation.isPending) mutation.mutate(); } });
}

function visibleMall(context: ConsoleContext, scope: ConsoleContext['scopes'][number]): boolean {
  if (context.scope.kind === 'platform' || scope.id === context.scope.id) return true;
  return scope.path?.some((part) => part.id === context.scope.id) === true;
}
