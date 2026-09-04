import { chineseReference, queryCondition, safeQueryError, presentError, type Receipt } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ExperienceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import { pageCursor } from '../../../shared/url/PageCursor';
import { experienceCopyIdentity } from '../model/ExperienceCopy';
import { experienceOperations, type Experience, type ExperienceAction, type ExperienceStatus, type ExperienceView } from '../model/Experience';
import { experienceScopePresentation } from '../model/ExperienceScope';
import { applicationSummary, commerceFlow, matchesExperienceSearch, matchesExperienceView } from '../model/ExperienceWorkspace';
import { useExperienceDetailViewModel } from './DetailViewModel';
import { useEntryViewModel } from './EntryViewModel';
import { applicationsKey } from './ExperienceQueryKey';
import { useVersionViewModel } from './VersionViewModel';

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
  const summary = useMemo(() => applicationSummary(query.data?.items ?? []), [query.data?.items]);
  const [action, setAction] = useState<ExperienceAction | null>(null);
  const [name, setName] = useState('主打团员工福利商城');
  const [code, setCode] = useState('ZHUDATUAN_EMPLOYEE');
  const [slug, setSlug] = useState('zhudatuan-employee');
  const [status, setStatus] = useState<ExperienceStatus>('draft');
  const [confirmed, setConfirmed] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<Receipt>();
  const actionId = identify(action);
  useEffect(() => {
    const record = action && 'record' in action ? action.record : undefined;
    const copy = action?.kind === 'copy' ? experienceCopyIdentity(action.record) : undefined;
    setName(copy?.name ?? record?.name ?? '主打团员工福利商城');
    setCode(copy?.code ?? 'ZHUDATUAN_EMPLOYEE');
    setSlug(copy?.slug ?? 'zhudatuan-employee');
    setStatus(record?.status ?? 'draft');
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
    setReceipt(undefined);
  }, [action, actionId, dependencies]);
  const refresh = useCallback(() => query.refetch(), [query]);
  const mutation = useMutation({
    mutationFn: async (input: Readonly<{ action: Exclude<ExperienceAction, { kind: 'design' }>; name: string; code: string; slug: string; status: ExperienceStatus; identity: string }>) => {
      if (input.action.kind === 'create') return dependencies.create.execute(context, { name: input.name.trim(), code: input.code, publicSlug: input.slug }, input.identity);
      if (input.action.kind === 'copy') return dependencies.copy.execute(context, input.action.record.id, { name: input.name.trim(), code: input.code, publicSlug: input.slug }, input.identity);
      return dependencies.update.execute(context, input.action.record.id, input.action.record.version, { name: input.name.trim(), status: input.status }, input.identity);
    },
    onSuccess: async (record, input) => {
      setReceipt(
        Object.freeze({
          requestId: input.identity,
          reference: record.id,
          occurredAt: record.updatedAt,
          message: input.action.kind === 'create' ? '商城应用、初始草稿和商品池绑定已原子创建。' : input.action.kind === 'copy' ? '商城应用已复制并建立独立版本链。' : '商城经营设置已保存并完成权威重读。',
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
  const validation = validateAction(action, name, code, slug, confirmed);
  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
    setReceipt(undefined);
  };
  const openAction = (next: ExperienceAction) => setAction(next);
  const closeAction = () => setAction(null);
  const submit = () => {
    if (!action || action.kind === 'design' || validation || mutation.isPending) return;
    const required = requiredAssurance(operation(action));
    if (context.session.assurance.level < required) {
      requestStepup();
      return;
    }
    mutation.mutate({ action, name, code, slug, status, identity });
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
    update: canUseOperation(context, experienceOperations.update),
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
      name,
      code,
      slug,
      status,
      confirmed,
      validation,
      required: action && action.kind !== 'design' ? requiredAssurance(operation(action)) : 0,
      assurance: context.session.assurance.level,
      busy: mutation.isPending,
      error: mutation.error ? presentError(mutation.error).message : undefined,
      receipt,
      actions: Object.freeze({
        open: openAction,
        close: closeAction,
        name: change(setName),
        code: change(setCode),
        slug: change(setSlug),
        status: (value: ExperienceStatus) => {
          setStatus(value);
          setConfirmed(false);
          setIdentity(dependencies.createIdentity());
          setReceipt(undefined);
        },
        confirmed: setConfirmed,
        submit,
        stepup: requestStepup,
      }),
    }),
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
function operation(action: Exclude<ExperienceAction, { kind: 'design' }>) {
  return action.kind === 'create' ? experienceOperations.create : action.kind === 'copy' ? experienceOperations.copy : experienceOperations.update;
}
function validateAction(action: ExperienceAction | null, name: string, code: string, slug: string, confirmed: boolean): string | undefined {
  if (!action || action.kind === 'design') return undefined;
  if (!name.trim() || name.trim().length > 120) return '商城名称须为 1 至 120 个字符。';
  if (action.kind !== 'manage' && !/^[A-Z][A-Z0-9_]{2,31}$/.test(code)) return '应用代码须以字母开头，只能包含大写字母、数字和下划线。';
  if (action.kind !== 'manage' && !/^[a-z0-9][a-z0-9-]{2,47}$/.test(slug)) return '公开路径须为 3 至 48 个小写字母、数字或连字符。';
  if (!confirmed) return '请先核对商城范围与本次变更。';
  return undefined;
}

export type ApplicationViewModel = ReturnType<typeof useApplicationViewModel>;
