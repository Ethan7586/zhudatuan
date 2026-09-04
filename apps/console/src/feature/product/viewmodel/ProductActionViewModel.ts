import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { actionState, presentError, type ProductStatus, type ProductType } from '@shop/presentation';
import { OP_CATALOG_LISTINGS_PRICE_SET, OP_CATALOG_PRODUCTS_CREATE, OP_CATALOG_PRODUCTS_UPDATE } from '@shop/contract/ids';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductAction } from '../model/ProductAction';
import type { ProductCommand } from '../public';
import { identityFor, type CommandIdentity } from '../../../shared/action/CommandIdentity';
import { canUseOperation } from '../../../shared/security/OperationAccess';

export function useProductActionViewModel(action: ProductAction | null, context: ConsoleContext, dependencies: ProductDependencies, onDone: () => void) {
  const listing = action !== null && 'listing' in action ? action.listing : undefined;
  const allowed = action === null || canUseOperation(context, action.operation);
  const [title, setTitle] = useState(listing?.title ?? '');
  const [category, setCategory] = useState(listing?.category_id ?? '');
  const [type, setType] = useState<ProductType>('physical');
  const [status, setStatus] = useState<ProductStatus>(action?.operation === OP_CATALOG_PRODUCTS_UPDATE ? action.status : 'draft');
  const [amount, setAmount] = useState('');
  const actionkey = action === null ? 'closed' : `${action.operation}:${listing?.id ?? 'new'}`;
  const commandidentity = useRef<CommandIdentity | undefined>(undefined);
  useEffect(() => {
    setTitle(listing?.title ?? '');
    setCategory(listing?.category_id ?? '');
    setType('physical');
    setStatus(action?.operation === OP_CATALOG_PRODUCTS_UPDATE ? action.status : 'draft');
    setAmount('');
  }, [actionkey, action, listing]);
  const identity = identityFor(commandidentity, JSON.stringify({ actionkey, amount, category, status, title, type }), dependencies.createIdentity);
  const mutation = useMutation({
    mutationKey: ['productaction', actionkey],
    mutationFn: async () => {
      if (action === null) throw new Error('PRODUCT_ACTION_MISSING');
      const request = command(context, identity);
      if (action.operation === OP_CATALOG_PRODUCTS_CREATE) return dependencies.executeAction.execute(request, { operation: action.operation, body: { title: title.trim(), category: category.trim(), type } });
      if (action.operation === OP_CATALOG_PRODUCTS_UPDATE)
        return dependencies.executeAction.execute(request, { operation: action.operation, listing: action.listing, expectedVersion: action.expectedVersion, body: { title: title.trim(), category: category.trim(), status } });
      if (action.operation === OP_CATALOG_LISTINGS_PRICE_SET)
        return dependencies.executeAction.execute(request, { operation: action.operation, listing: action.listing, expectedVersion: action.expectedVersion, body: { amountMinor: priceMinor(amount), currency: 'CNY' } });
      return dependencies.executeAction.execute(request, action);
    },
    onSuccess: onDone,
  });
  const state = actionState({ pending: mutation.isPending, commandId: identity, ...(mutation.data === undefined ? {} : { result: mutation.data }), ...(mutation.error === null ? {} : { error: mutation.error }) });
  return Object.freeze({
    action,
    allowed,
    permissionReason: allowed ? undefined : '当前账号不能执行这项商品操作。',
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
      if (allowed && !mutation.isPending) mutation.mutate();
    },
  });
}

export function command(context: ConsoleContext, identity: string): ProductCommand {
  return Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, identity, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) });
}

export type ProductActionViewModel = ReturnType<typeof useProductActionViewModel>;

function priceMinor(value: string): number {
  const parsed = Number(value);
  const minor = Math.round(parsed * 100);
  if (!Number.isFinite(parsed) || minor <= 0 || minor > 99_999_999) throw new Error('销售价必须介于 0.01 与 999999.99 元之间');
  return minor;
}
