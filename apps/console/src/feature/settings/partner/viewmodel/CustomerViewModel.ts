import { OP_PARTNER_CUSTOMERS_GET, OP_PARTNER_CUSTOMERS_LIST } from '@shop/contract/ids';
import { hasFailureCode, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PartnerDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { Customer, CustomerChange, CustomerKind, CustomerStatus } from '../model/Customer';
import { customerConflict, type CustomerConflict } from '../model/CustomerConflict';
import { customerChange, editCustomerEditor, newCustomerEditor, rebaseCustomerEditor, stateCustomerEditor, validateCustomer, type CustomerEditor, type CustomerProfileEditor } from '../model/CustomerEditor';
import { customerAccess } from './CustomerAccess';
import { useCustomerQuery } from './CustomerQuery';

interface CustomerCommand {
  readonly change: CustomerChange;
  readonly identity: string;
}

export function useCustomerViewModel(context: ConsoleContext, dependencies: PartnerDependencies, active: boolean, requestStepup: () => void) {
  const access = customerAccess(context);
  const filters = useCustomerQuery();
  const [searchText, setSearchText] = useState(filters.query.q ?? '');
  const [selection, setSelection] = useState<Customer>();
  const [editor, setEditor] = useState<CustomerEditor>();
  const [reviewing, setReviewing] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<Customer>();
  const [conflict, setConflict] = useState<CustomerConflict>();
  useEffect(() => setSearchText(filters.query.q ?? ''), [filters.query.q]);
  const query = useQuery({
    queryKey: Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_PARTNER_CUSTOMERS_LIST, filters.query] as const),
    queryFn: ({ signal }) => dependencies.readCustomers.execute(context, filters.query, signal),
    enabled: active && access.canList,
  });
  const detail = useQuery({
    queryKey: Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_PARTNER_CUSTOMERS_GET, selection?.id ?? null] as const),
    queryFn: ({ signal }) => dependencies.readCustomer.execute(context, selection!.id, signal),
    enabled: active && access.canGet && selection !== undefined,
  });
  const refetch = query.refetch;
  const mutation = useMutation({
    mutationFn: ({ change, identity: requestIdentity }: CustomerCommand) => dependencies.manageCustomer.execute(context, change, requestIdentity),
    onSuccess: async (customer) => {
      const read = await refetch();
      if (read.error) throw read.error;
      setEditor(undefined);
      setSelection(undefined);
      setReviewing(false);
      setConflict(undefined);
      setReceipt(customer);
    },
    onError: async (cause, command) => {
      const change = command.change;
      if (!hasFailureCode(cause, 'VERSION_CONFLICT') || change.kind === 'create') return;
      const current = await refetch();
      const latest = current.data?.items.find((item) => item.id === change.customer.id);
      setConflict(customerConflict(change.customer, latest));
      if (latest) setEditor((value) => value === undefined ? value : rebaseCustomerEditor(value, latest));
      setReviewing(false);
      setIdentity(dependencies.createIdentity());
    },
  });
  const pending = mutation.isPending;
  const reset = mutation.reset;
  const begin = useCallback((value: CustomerEditor) => {
    if (pending) return;
    setSelection(undefined);
    setEditor(value);
    setReviewing(false);
    setConflict(undefined);
    setIdentity(dependencies.createIdentity());
    reset();
  }, [dependencies, pending, reset]);
  const update = useCallback((change: Partial<CustomerProfileEditor> | Readonly<{ reason: string }>) => {
    if (pending) return;
    setEditor((current) => current === undefined ? current : { ...current, ...change } as CustomerEditor);
    setReviewing(false);
    setConflict(undefined);
    setIdentity(dependencies.createIdentity());
    reset();
  }, [dependencies, pending, reset]);
  const validation = validateCustomer(editor);
  const submit = useCallback(() => {
    if (editor === undefined || validation !== undefined || !reviewing || pending || conflict !== undefined || context.session.assurance.level < 2) return;
    mutation.mutate({ change: customerChange(editor), identity });
  }, [conflict, context.session.assurance.level, editor, identity, mutation, pending, reviewing, validation]);
  const close = useCallback(() => {
    if (!pending) { setEditor(undefined); setReviewing(false); setConflict(undefined); }
  }, [pending]);
  const actions = useMemo(() => Object.freeze({
    searchText: setSearchText,
    search: () => filters.change('q', searchText.trim()),
    customerKind: (value: CustomerKind | '') => filters.change('customerKind', value),
    customerStatus: (value: CustomerStatus | '') => filters.change('customerStatus', value),
    next: filters.next,
    first: filters.first,
    refresh: () => void refetch(),
    select: setSelection,
    closeDetail: () => setSelection(undefined),
    create: () => begin(newCustomerEditor()),
    edit: (customer: Customer) => begin(editCustomerEditor(customer)),
    enable: (customer: Customer) => begin(stateCustomerEditor(customer, 'enable')),
    disable: (customer: Customer) => begin(stateCustomerEditor(customer, 'disable')),
    close,
    preview: () => { if (validation === undefined && !pending) setReviewing(true); },
    revise: () => setReviewing(false),
    resolveConflict: () => { setConflict(undefined); reset(); },
    submit,
    stepup: requestStepup,
    update,
    dismissReceipt: () => setReceipt(undefined),
  }), [begin, close, filters, pending, refetch, requestStepup, reset, searchText, submit, update, validation]);
  return Object.freeze({
    access,
    query: filters.query,
    searchText,
    page: query.data,
    selection,
    detail: Object.freeze({ value: detail.data, condition: queryCondition({ pending: detail.isPending, fetching: detail.isFetching, error: detail.error, hasData: detail.data !== undefined, empty: false }), error: safeQueryError(detail.error), refresh: () => void detail.refetch() }),
    editor,
    reviewing,
    conflict,
    receipt,
    validation: conflict ? '客户状态已变化，请核对权威差异后重新确认。' : validation,
    assurance: context.session.assurance.level,
    condition: access.canList ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 }) : 'forbidden' as const,
    error: access.canList ? safeQueryError(query.error) : '当前账号没有查看客户资料的权限。',
    fetching: query.isFetching,
    saving: Object.freeze({ busy: pending, error: safeQueryError(mutation.error) }),
    actions,
  });
}

export type CustomerViewModel = ReturnType<typeof useCustomerViewModel>;
