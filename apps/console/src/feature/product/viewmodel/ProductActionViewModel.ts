import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { actionState, presentError } from '@shop/presentation';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductAction, ProductStatus } from '../model/ProductAction';
import type { ProductCommand } from '../public';

export interface ProductActionViewModel {
  readonly action: ProductAction | null;
  readonly title: string;
  readonly category: string;
  readonly type: 'physical' | 'virtual' | 'service' | 'voucher';
  readonly status: ProductStatus;
  readonly amount: string;
  readonly submitting: boolean;
  readonly error?: string;
  readonly setTitle: (value: string) => void;
  readonly setCategory: (value: string) => void;
  readonly setType: (value: ProductActionViewModel['type']) => void;
  readonly setStatus: (value: ProductStatus) => void;
  readonly setAmount: (value: string) => void;
  readonly submit: () => void;
}

export function useProductActionViewModel(action: ProductAction | null, context: ConsoleContext, dependencies: ProductDependencies, onDone: () => void): ProductActionViewModel {
  const listing = action !== null && 'listing' in action ? action.listing : undefined;
  const [title, setTitle] = useState(listing?.title ?? '主打团臻选员工福利礼盒');
  const [category, setCategory] = useState('企业福利专区');
  const [type, setType] = useState<ProductActionViewModel['type']>('physical');
  const [status, setStatus] = useState<ProductStatus>(action?.kind === 'edit' ? action.status : 'active');
  const [amount, setAmount] = useState('99.00');
  const actionkey = action === null ? 'closed' : `${action.kind}:${listing?.id ?? 'new'}`;
  const identity = useMemo(() => Object.freeze({ actionkey, value: crypto.randomUUID() }).value, [actionkey]);
  const mutation = useMutation({
    mutationKey: ['productaction', actionkey],
    mutationFn: async () => {
      if (action === null) throw new Error('PRODUCT_ACTION_MISSING');
      const request = command(context, identity);
      if (action.kind === 'create') return dependencies.executeAction.execute(request, { kind: 'create', draft: { title, category, type } });
      if (action.kind === 'edit') return dependencies.executeAction.execute(request, { kind: 'edit', listing: action.listing, title, category, status });
      if (action.kind === 'price') return dependencies.executeAction.execute(request, { kind: 'price', listing: action.listing, amountMinor: priceMinor(amount) });
      return dependencies.executeAction.execute(request, action);
    },
    onSuccess: onDone,
  });
  const state = actionState({ pending: mutation.isPending, commandId: identity, ...(mutation.data === undefined ? {} : { result: mutation.data }), ...(mutation.error === null ? {} : { error: mutation.error }) });
  return Object.freeze({
    action,
    state,
    title,
    category,
    type,
    status,
    amount,
    submitting: mutation.isPending,
    ...(mutation.error === null ? {} : { error: presentError(mutation.error).message }),
    setTitle,
    setCategory,
    setType,
    setStatus,
    setAmount,
    submit: () => {
      if (!mutation.isPending) mutation.mutate();
    },
  });
}

export function command(context: ConsoleContext, identity = crypto.randomUUID()): ProductCommand {
  return Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, identity, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) });
}

function priceMinor(value: string): number {
  const parsed = Number(value);
  const minor = Math.round(parsed * 100);
  if (!Number.isFinite(parsed) || minor <= 0 || minor > 99_999_999) throw new Error('销售价必须介于 0.01 与 999999.99 元之间');
  return minor;
}
