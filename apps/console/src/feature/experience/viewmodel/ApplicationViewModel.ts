import { chineseReference, queryCondition, safeQueryError, presentError, type Receipt } from '@shop/presentation';
import { OP_ORGANIZATION_MALLS_UPDATE } from '@shop/contract/ids';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ExperienceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import { pageCursor } from '../../../shared/query/QueryState';
import { experienceOperations, type Experience, type ExperienceAction, type ExperienceView } from '../model/Experience';
import { experienceScopePresentation } from '../model/ExperienceScope';
import { applicationSummary, commerceFlow, matchesExperienceSearch, matchesExperienceView } from '../model/ExperienceWorkspace';
import { useExperienceDetailViewModel } from './DetailViewModel';
import { useEntryViewModel } from './EntryViewModel';
import { applicationsKey } from './ExperienceQueryKey';
import { useVersionViewModel } from './VersionViewModel';
import { useMallCreationViewModel } from './MallCreationViewModel';

export const experienceViews: readonly Readonly<{ key: ExperienceView; label: string }>[] = Object.freeze([
  { key: 'all', label: '全部商城应用' },
  { key: 'published', label: '已发布' },
  { key: 'drafts', label: '开店与装修草稿' },
  { key: 'attention', label: '需要处理' },
]);

export function useApplicationViewModel(context: ConsoleContext, dependencies: ExperienceDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: applicationsKey(context, cursor), queryFn: ({ signal }) => dependencies.readList.execute(context, cursor, signal), staleTime: 60_000 });
  const presentation = experienceScopePresentation(context.scope.kind);
  const view = readView(search.get('view'));
  const searchText = search.get('q') ?? '';
  const selectedId = search.get('selected') ?? undefined;
  const selected = query.data?.items.find((record) => record.id === selectedId);
  const rows = useMemo(() => (query.data?.items ?? []).filter((record) => matchesExperienceView(record, view) && matchesExperienceSearch(record, searchText)), [query.data?.items, searchText, view]);
  const copyTargets = useMemo(() => (query.data?.items ?? []).map((record) => Object.freeze({ applicationId: record.id, mallId: record.mallId, name: record.name })), [query.data?.items]);
  const summary = useMemo(() => applicationSummary(query.data?.items ?? []), [query.data?.items]);
  const [action, setAction] = useState<ExperienceAction | null>(null);
  const [targetMallId, setTargetMallId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<Receipt>();
  const actionId = identify(action);
  useEffect(() => {
    setTargetMallId(action?.kind === 'copy' ? (copyTargets.find((candidate) => candidate.applicationId !== action.record.id)?.mallId ?? '') : '');
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
    setReceipt(undefined);
  }, [action, actionId, copyTargets, dependencies]);
  const refresh = useCallback(() => query.refetch(), [query]);
  const creation = useMallCreationViewModel(context, dependencies, action, requestStepup, refresh);
  const mutation = useMutation({
    mutationFn: async (input: Readonly<{ action: Extract<ExperienceAction, { kind: 'copy' }>; targetMallId: string; identity: string }>) => dependencies.copy.execute(context, input.action.record.id, input.targetMallId, input.identity),
    onSuccess: async (record, input) => {
      setReceipt(
        Object.freeze({
          requestId: input.identity,
          reference: record.id,
          occurredAt: record.updatedAt,
          message: '装修草稿已复制到目标商城并建立独立版本；域名、密钥和发布状态保持不变。',
        })
      );
      await refresh();
    },
  });
  const updateSearch = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(search);
      mutate(next);
      setSearch(next);
    },
    [search, setSearch]
  );
  const detail = useExperienceDetailViewModel(context, dependencies, selected?.id);
  const entry = useEntryViewModel();
  const version = useVersionViewModel(action, context, dependencies, requestStepup, refresh);
  const validation = validateAction(action, targetMallId, confirmed);
  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
    setReceipt(undefined);
  };
  const openAction = (next: ExperienceAction) => setAction(next);
  const closeAction = () => setAction(null);
  const submit = () => {
    if (!action || action.kind !== 'copy' || validation || mutation.isPending) return;
    const required = requiredAssurance(experienceOperations.copy);
    if (context.session.assurance.level < required) {
      requestStepup();
      return;
    }
    mutation.mutate({ action, targetMallId, identity });
  };
  const selectView = (nextView: ExperienceView) =>
    updateSearch((next) => {
      if (nextView === 'all') next.delete('view');
      else next.set('view', nextView);
      next.delete('cursor');
      next.delete('selected');
    });
  const updateQuery = (value: string) =>
    updateSearch((next) => {
      if (value === '') next.delete('q');
      else next.set('q', value);
      next.delete('cursor');
      next.delete('selected');
    });
  const openRecord = (record: Experience) => updateSearch((next) => next.set('selected', record.id));
  const closeRecord = () => updateSearch((next) => next.delete('selected'));
  const clearFilters = () =>
    updateSearch((next) => {
      next.delete('q');
      next.delete('view');
      next.delete('cursor');
      next.delete('selected');
    });
  const nextPage = () => {
    if (query.data?.nextCursor) setSearch(pageCursor(search, query.data.nextCursor));
  };
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: false });
  const permissions = Object.freeze({
    create: canUseOperation(context, experienceOperations.create),
    copy: canUseOperation(context, experienceOperations.copy),
    update: canUseOperation(context, OP_ORGANIZATION_MALLS_UPDATE),
    publish: canUseOperation(context, experienceOperations.publish),
  });
  return Object.freeze({
    presentation,
    scopeName: context.scope.name ?? chineseReference('组织范围', context.scope.id),
    condition,
    error: safeQueryError(query.error),
    data: query.data,
    rows,
    summary,
    flow: commerceFlow(presentation.mode),
    view,
    views: experienceViews,
    search: searchText,
    selected,
    detail,
    entry,
    action: Object.freeze({
      value: action,
      targetMallId,
      copyTargets: action?.kind === 'copy' ? copyTargets.filter((candidate) => candidate.applicationId !== action.record.id) : [],
      confirmed,
      validation,
      required: action?.kind === 'copy' ? requiredAssurance(experienceOperations.copy) : 0,
      assurance: context.session.assurance.level,
      busy: mutation.isPending,
      error: mutation.error ? presentError(mutation.error).message : undefined,
      receipt,
      actions: Object.freeze({
        open: openAction,
        close: closeAction,
        targetMall: change(setTargetMallId),
        confirmed: setConfirmed,
        submit,
        stepup: requestStepup,
      }),
    }),
    creation,
    version,
    permissions,
    fetching: query.isFetching,
    actions: Object.freeze({ refresh: () => void query.refetch(), selectView, search: updateQuery, openRecord, closeRecord, clearFilters, nextPage }),
  });
}

function readView(value: string | null): ExperienceView {
  return experienceViews.some((candidate) => candidate.key === value) ? (value as ExperienceView) : 'all';
}
function identify(action: ExperienceAction | null): string {
  return !action ? 'closed' : action.kind === 'create' ? action.kind : `${action.kind}:${action.record.id}`;
}
function validateAction(action: ExperienceAction | null, targetMallId: string, confirmed: boolean): string | undefined {
  if (action?.kind !== 'copy') return undefined;
  if (action.kind === 'copy' && !targetMallId) return '请选择接收装修草稿的目标商城。';
  if (!confirmed) return '请先核对商城范围与本次变更。';
  return undefined;
}

export type ApplicationViewModel = ReturnType<typeof useApplicationViewModel>;
