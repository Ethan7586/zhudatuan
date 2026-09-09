import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OP_CATALOG_CATEGORIES_CREATE, OP_CATALOG_CATEGORIES_READ } from '@shop/contract/ids';
import { presentError } from '@shop/presentation';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { identityFor, type CommandIdentity } from '../../../shared/action/CommandIdentity';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import type { ProductCategory } from '../model/Product';
import { categoryKey } from './ProductQueryKey';
import { productCommand } from './ProductCommand';

export function useProductCategoryViewModel(
  instance: string,
  open: boolean,
  selected: string,
  current: Readonly<{ id: string; name: string }> | undefined,
  select: (id: string) => void,
  context: ConsoleContext,
  dependencies: ProductDependencies,
  requestStepup: () => void
) {
  const request = Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion });
  const canRead = canUseOperation(context, OP_CATALOG_CATEGORIES_READ);
  const capabilityAllowsCreate = canUseOperation(context, OP_CATALOG_CATEGORIES_CREATE);
  const canCreate = capabilityAllowsCreate && context.scope.kind === 'platform';
  const queryclient = useQueryClient();
  const query = useQuery({
    queryKey: categoryKey(context),
    queryFn: ({ signal }) => dependencies.readCategories.execute(request, signal),
    enabled: open && canRead,
    staleTime: 60_000,
  });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [created, setCreated] = useState<ProductCategory | undefined>(undefined);
  const commandidentity = useRef<CommandIdentity | undefined>(undefined);
  const identity = identityFor(commandidentity, JSON.stringify({ instance, name: name.trim(), parent }), dependencies.createIdentity);
  useEffect(() => {
    setAdding(false);
    setName('');
    setParent('');
    setCreated(undefined);
  }, [instance]);
  const mutation = useMutation({
    mutationKey: ['productcategory', instance],
    mutationFn: () => dependencies.createCategory.execute(productCommand(context, identity), { name: name.trim(), parent: parent === '' ? null : parent, sort: 0 }),
    onSuccess: (value) => {
      setCreated(value);
      select(value.id);
      setAdding(false);
      setName('');
      setParent('');
      void queryclient.invalidateQueries({ queryKey: categoryKey(context) });
    },
  });
  const categories = useMemo(() => categoryChoices(query.data?.items ?? [], created, current), [created, current, query.data?.items]);
  const selectedCategory = categories.find(({ id }) => id === selected);
  const selectionIssue = selectedCategory !== undefined && selectedCategory.status !== 'active' ? `当前分类“${selectedCategory.name}”已停用，请重新选择。` : undefined;
  const queryError = query.error === null ? undefined : presentError(query.error).message;
  const createError = mutation.error === null ? undefined : presentError(mutation.error).message;
  return Object.freeze({
    categories,
    selected,
    selectedName: selectedCategory?.name,
    selectionIssue,
    canRead,
    canCreate,
    adding,
    name,
    parent,
    loading: query.isLoading,
    creating: mutation.isPending,
    blocked: open && (!canRead || query.isError || query.isLoading || selected === '' || selectedCategory?.status !== 'active'),
    queryError,
    createError,
    createReason: canCreate
      ? undefined
      : !canRead
        ? '当前账号不能读取商品分类，无法保存商品。'
        : capabilityAllowsCreate
          ? '新增分类属于平台级商品治理，请先切换到平台范围。'
          : '当前账号可以选择已有分类，但不能新增分类。',
    select,
    setName,
    setParent,
    openCreate: () => {
      mutation.reset();
      setAdding(true);
    },
    closeCreate: () => {
      if (mutation.isPending) return;
      mutation.reset();
      setAdding(false);
      setName('');
      setParent('');
    },
    retry: () => void query.refetch(),
    create: () => {
      if (!canCreate || mutation.isPending || name.trim() === '') return;
      if (context.session.assurance.level < requiredAssurance(OP_CATALOG_CATEGORIES_CREATE)) {
        requestStepup();
        return;
      }
      mutation.mutate();
    },
  });
}

function categoryChoices(values: readonly ProductCategory[], created: ProductCategory | undefined, current: Readonly<{ id: string; name: string }> | undefined): readonly ProductCategory[] {
  const choices = new Map<string, ProductCategory>();
  for (const value of values) if (value.status === 'active') choices.set(value.id, value);
  if (created !== undefined) choices.set(created.id, created);
  if (current !== undefined && !choices.has(current.id)) {
    choices.set(current.id, Object.freeze({ id: current.id, parent_id: null, parent_name: null, code: 'CURRENT', name: current.name, status: 'disabled', sort_order: 0, product_count: 0 }));
  }
  return Object.freeze(
    [...choices.values()].sort((left, right) => `${left.parent_name ?? ''}\u0000${left.name}`.localeCompare(`${right.parent_name ?? ''}\u0000${right.name}`, 'zh-CN'))
  );
}

export type ProductCategoryViewModel = ReturnType<typeof useProductCategoryViewModel>;
