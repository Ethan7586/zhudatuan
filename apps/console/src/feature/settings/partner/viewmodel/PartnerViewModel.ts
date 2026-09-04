import { OP_ORGANIZATION_STORES_MANAGE, OP_ORGANIZATION_STORES_READ, OP_PARTNER_PARTNERS_MANAGE, OP_PARTNER_PARTNERS_READ } from '@shop/contract/ids';
import { queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { PartnerDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import { pageCursor } from '../../../../shared/query/QueryState';
import type { PartnerPage, PartnerStatus } from '../model/Partner';
import type { PartnerReceipt, StorePage } from '../model/Store';
import { partnerSection, serviceRadius, validatePartnerEditor, type PartnerEditorState, type PartnerSection, type PartnerSelection, type StoreEditor } from '../model/PartnerEditor';
interface Command {
  readonly editor: PartnerEditorState;
  readonly identity: string;
}

export function usePartnerViewModel(context: ConsoleContext, dependencies: PartnerDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const section = partnerSection(search.get('kind'));
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery<PartnerPage | StorePage>({
    queryKey: Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, section === 'store' ? OP_ORGANIZATION_STORES_READ : OP_PARTNER_PARTNERS_READ, section, cursor ?? null, 50] as const),
    queryFn: ({ signal }) => (section === 'store' ? dependencies.readStores.execute(context, cursor, signal) : dependencies.readPartners.execute(context, section === 'customer' ? 'supplier' : section, cursor, signal)),
    enabled: section !== 'customer',
  });
  const [selection, setSelection] = useState<PartnerSelection>();
  const [editor, setEditor] = useState<PartnerEditorState>();
  const [reviewing, setReviewing] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<PartnerReceipt>();
  const refetch = query.refetch;
  const mutation = useMutation({
    mutationFn: async ({ editor: value, identity: requestIdentity }: Command) => {
      const receipt =
        value.kind === 'partner'
          ? await dependencies.managePartner.execute(context, { id: value.id, kind: value.partnerKind, name: value.name, status: value.status, version: value.original?.version ?? 0 }, requestIdentity)
          : await dependencies.manageStore.execute(
              context,
              {
                id: value.id,
                name: value.name,
                status: value.status,
                version: value.original?.version ?? 0,
                mallId: value.mallId.trim() || null,
                regionCode: value.regionCode.trim(),
                serviceRadiusMeters: serviceRadius(value.radius),
                ...(value.addressMode === 'preserve' ? {} : { address: value.addressMode === 'remove' ? null : value.address.trim() }),
              },
              requestIdentity
            );
      const read = await refetch();
      if (read.error) throw read.error;
      return receipt;
    },
    onSuccess: (value) => {
      setEditor(undefined);
      setReviewing(false);
      setSelection(undefined);
      setReceipt(value);
    },
  });
  const pending = mutation.isPending;
  const reset = mutation.reset;
  const update = useCallback(
    (change: Partial<PartnerEditorState>) => {
      if (pending) return;
      setReviewing(false);
      setEditor((current) => (current === undefined ? current : ({ ...current, ...change } as PartnerEditorState)));
      setIdentity(dependencies.createIdentity());
      reset();
    },
    [dependencies, pending, reset]
  );
  const changeSection = useCallback(
    (value: PartnerSection) => {
      if (pending) return;
      setSelection(undefined);
      setEditor(undefined);
      setReviewing(false);
      setSearch((current) => {
        const next = new URLSearchParams(current);
        next.set('kind', value);
        next.delete('cursor');
        return next;
      });
    },
    [pending, setSearch]
  );
  const create = useCallback(() => {
    if (pending || section === 'customer') return;
    const id = dependencies.createReference(section);
    setIdentity(dependencies.createIdentity());
    setReviewing(false);
    reset();
    setEditor(
      section === 'store'
        ? { kind: 'store', id, name: '', status: 'pending', mallId: context.scope.kind === 'mall' ? context.scope.id : '', regionCode: '', radius: '', addressMode: 'replace', address: '' }
        : { kind: 'partner', id, partnerKind: section, name: '', status: 'pending' }
    );
  }, [context, dependencies, pending, reset, section]);
  const edit = useCallback(
    (item: PartnerSelection) => {
      if (pending) return;
      setSelection(undefined);
      setIdentity(dependencies.createIdentity());
      setReviewing(false);
      reset();
      setEditor(
        item.kind === 'partner'
          ? { kind: 'partner', original: item.value, id: item.value.id, partnerKind: item.value.kind, name: item.value.name, status: item.value.status }
          : {
              kind: 'store',
              original: item.value,
              id: item.value.id,
              name: item.value.name,
              status: item.value.status,
              mallId: item.value.mallId ?? '',
              regionCode: item.value.regionCode,
              radius: item.value.serviceRadiusMeters?.toString() ?? '',
              addressMode: 'preserve',
              address: '',
            }
      );
    },
    [dependencies, pending, reset]
  );
  const validation = validatePartnerEditor(editor);
  const submit = useCallback(() => {
    if (editor === undefined || validation !== undefined || pending || !reviewing) return;
    mutation.mutate({ editor, identity });
  }, [editor, identity, mutation, pending, reviewing, validation]);
  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);
  const next = useCallback((value: string) => setSearch(pageCursor(search, value)), [search, setSearch]);
  const first = useCallback(
    () =>
      setSearch((current) => {
        const next = new URLSearchParams(current);
        next.delete('cursor');
        return next;
      }),
    [setSearch]
  );
  const close = useCallback(() => {
    if (!pending) {
      setEditor(undefined);
      setReviewing(false);
    }
  }, [pending]);
  const actions = useMemo(
    () =>
      Object.freeze({
        section: changeSection,
        create,
        select: setSelection,
        closeDrawer: () => setSelection(undefined),
        edit,
        close,
        preview: () => {
          if (validation === undefined && !pending) setReviewing(true);
        },
        revise: () => {
          if (!pending) setReviewing(false);
        },
        submit,
        refresh,
        next,
        first,
        stepup: requestStepup,
        dismissReceipt: () => setReceipt(undefined),
        name: (name: string) => update({ name }),
        status: (status: PartnerStatus) => update({ status }),
        mallId: (mallId: string) => update({ mallId }),
        regionCode: (regionCode: string) => update({ regionCode }),
        radius: (value: string) => update({ radius: value }),
        addressMode: (addressMode: StoreEditor['addressMode']) => update({ addressMode }),
        address: (address: string) => update({ address }),
      }),
    [changeSection, close, create, edit, first, next, pending, refresh, requestStepup, submit, update, validation]
  );
  const page = query.data;
  return Object.freeze({
    section,
    cursor,
    partners: section === 'store' || section === 'customer' ? undefined : (page as PartnerPage | undefined),
    stores: section === 'store' ? (page as StorePage | undefined) : undefined,
    selection,
    editor,
    reviewing,
    receipt,
    validation,
    assurance: context.session.assurance.level,
    canManage: section === 'customer' ? false : section === 'store' ? canUseOperation(context, OP_ORGANIZATION_STORES_MANAGE) : canUseOperation(context, OP_PARTNER_PARTNERS_MANAGE),
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    saving: Object.freeze({ busy: pending, error: safeQueryError(mutation.error) }),
    actions,
  });
}

export type PartnerViewModel = ReturnType<typeof usePartnerViewModel>;
