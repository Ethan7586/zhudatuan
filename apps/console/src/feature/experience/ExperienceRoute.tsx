import { queryCondition, safeQueryError } from '@shop/presentation';
import { Button, ResourcePanel } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';

import { pageCursor } from '../../shared/url/PageCursor';
import { ExperienceRecordDrawer } from './ExperienceDialogs';
import { ExperienceActionDialog, type ExperienceAction } from './ExperienceActions';
import { applicationSummary, commerceFlow, needsAttention } from './ExperiencePresentation';
import { applicationKey, readExperiences } from './ExperienceQuery';
import type { Experience } from './ExperienceSchema';
import { experienceScopePresentation, type CommerceWorkspaceMode } from './ExperienceScope';
import { ExperienceTable } from './ExperienceTable';
import { EntryDialog } from './entry/EntryDialog';
import './Workspace.css';
import './Table.css';
import './Dialogs.css';
import './Responsive.css';
import { useRouteTitle } from '../../shared/ui/RouteTitle';

type CommerceView = 'all' | 'published' | 'drafts' | 'attention';

const views: readonly Readonly<{ key: CommerceView; label: string }>[] = Object.freeze([
  { key: 'all', label: '全部商城应用' },
  { key: 'published', label: '已发布' },
  { key: 'drafts', label: '开店与装修草稿' },
  { key: 'attention', label: '需要处理' },
]);

export function Component() {
  const context = useConsoleContext();
  const [search, setSearch] = useSearchParams();
  const presentation = experienceScopePresentation(context.scope.kind);
  const routeTitle = useRouteTitle(presentation.title);
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({
    queryKey: applicationKey(context, cursor),
    queryFn: ({ signal }) => readExperiences(context, cursor, signal),
    staleTime: 60_000,
  });
  const data = query.data;
  const [action, setAction] = useState<ExperienceAction | null>(null);
  const [entry, setEntry] = useState<Experience | null>(null);
  const entryTrigger = useRef('');
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: data !== undefined,
    empty: false,
  });
  const error = safeQueryError(query.error);
  const view = readView(search.get('view'));
  const q = (search.get('q') ?? '').trim().toLowerCase();
  const selectedId = search.get('selected') ?? undefined;
  const selected = data?.items.find((record) => record.id === selectedId);
  const rows = useMemo(() => (data?.items ?? []).filter((record) => matchesView(record, view) && (q === '' || searchable(record).includes(q))), [data?.items, q, view]);
  const summary = useMemo(() => applicationSummary(data?.items ?? []), [data?.items]);
  const flow = commerceFlow(presentation.mode);

  const updateSearch = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(search);
      mutate(next);
      setSearch(next);
    },
    [search, setSearch]
  );
  const selectView = (nextView: CommerceView) =>
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
  const openRecord = useCallback(
    (record: Experience) => {
      updateSearch((next) => next.set('selected', record.id));
    },
    [updateSearch]
  );
  const closeRecord = useCallback(() => updateSearch((next) => next.delete('selected')), [updateSearch]);
  const openEntry = useCallback((record: Experience, trigger: HTMLButtonElement) => {
    entryTrigger.current = trigger.dataset.entryTrigger ?? '';
    setEntry(record);
  }, []);
  const closeEntry = useCallback(() => {
    const trigger = entryTrigger.current;
    entryTrigger.current = '';
    setEntry(null);
    requestAnimationFrame(() => restoreEntryFocus(trigger));
  }, []);
  const scopeName = context.scope.name ?? context.scope.id;

  return (
    <div className="commerceworkspace" data-mode={presentation.mode}>
      <ResourcePanel
        title={routeTitle}
        eyebrow={presentation.eyebrow}
        description={presentation.description}
        condition={condition}
        {...(error === undefined ? {} : { error })}
        retry={() => {
          void query.refetch();
        }}
        actions={
          <>
            <Button
              onPress={() => {
                void query.refetch();
              }}
            >
              刷新数据
            </Button>
            <Button
              tone="primary"
              onPress={() => setAction(presentation.mode === 'management' ? { kind: 'create' } : rows[0] === undefined ? null : { kind: 'design', record: rows[0] })}
              isDisabled={presentation.mode !== 'management' && rows.length === 0}
            >
              {presentation.primaryAction}
            </Button>
          </>
        }
      >
        <div className="commercecontent">
          <section className="commerceownership" role="note">
            <span className="commerceownershipicon" aria-hidden="true">
              域
            </span>
            <div>
              <strong>
                {presentation.ownership}：{scopeName}
              </strong>
              <p>{presentation.ownershipDetail}</p>
            </div>
            <span className="commerceversionrule">装修呈现以当前已发布版本为准</span>
          </section>
          <section className="commercesummary" aria-label="商城与应用读模型摘要">
            {summary.map((metric) => (
              <article key={metric.label} className={`is-${metric.tone}`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.hint}</small>
              </article>
            ))}
          </section>
          <section className="commerceboundarybanner" role="note">
            <span className="commerceboundaryicon" aria-hidden="true">
              !
            </span>
            <div>
              <strong>{presentation.mode === 'management' ? '商城创建与初始草稿已启用' : '装修版本链已启用'}</strong>
              <p>{boundaryMessage(presentation.mode)}</p>
            </div>
          </section>
          <ol className="commerceflow" aria-label={`${presentation.title}业务闭环`}>
            {flow.map((step, index) => (
              <li key={step.label}>
                <span>{index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </div>
              </li>
            ))}
          </ol>
          <section className="commerceboard" aria-labelledby="commerceboardtitle">
            <nav className="commercetabs" aria-label="商城与应用状态视图">
              {views.map((candidate) => (
                <button key={candidate.key} type="button" aria-pressed={candidate.key === view} onClick={() => selectView(candidate.key)}>
                  {candidate.label}
                </button>
              ))}
            </nav>
            <div className="commercefilterbar">
              <div>
                <strong id="commerceboardtitle">商城应用清单</strong>
                <span>应用、入口、草稿、校验与发布状态来自同一权威读模型</span>
              </div>
              <label className="commercesearch">
                <span className="sr-only">搜索商城应用</span>
                <input type="search" value={search.get('q') ?? ''} onChange={(event) => updateQuery(event.target.value)} placeholder="搜索名称、代码、商城或公开链接" />
              </label>
            </div>
            <p className="commercefiltermeta">
              当前页筛选 · 显示 {rows.length} / {data?.items.length ?? 0} 条 · 不推断未返回的商城总量
            </p>
            {data !== undefined && data.items.length === 0 ? (
              <section className="commerceempty" role="status">
                <strong>当前范围暂无商城应用</strong>
                <p>{presentation.mode === 'management' ? '点击创建商城，原子建立应用、初始装修草稿和商城商品池绑定。' : '当前商城暂无应用，请先从集团范围创建。'}</p>
              </section>
            ) : null}
            {data !== undefined && data.items.length > 0 && rows.length === 0 ? (
              <section className="commerceempty" role="status">
                <strong>当前页没有匹配记录</strong>
                <p>调整状态视图或搜索词即可恢复列表。</p>
                <button type="button" onClick={() => clearFilters(search, setSearch)}>
                  清除筛选
                </button>
              </section>
            ) : null}
            {rows.length > 0 ? (
              <ExperienceTable
                rows={rows}
                mode={presentation.mode}
                onOpen={openRecord}
                onManage={(record) => setAction({ kind: 'manage', record })}
                onEntry={openEntry}
                onCopy={(record) => setAction({ kind: 'copy', record })}
                onDesign={(record) => setAction({ kind: 'design', record })}
              />
            ) : null}
            <footer className="commercepagination">
              <span>服务端返回 {data?.count ?? 0} 条 · 游标分页</span>
              <Button
                onPress={() => {
                  if (data?.nextCursor !== undefined) setSearch(pageCursor(search, data.nextCursor));
                }}
                isDisabled={data?.nextCursor === undefined}
              >
                下一页
              </Button>
            </footer>
          </section>
        </div>
      </ResourcePanel>
      <ExperienceRecordDrawer record={selected} context={context} onClose={closeRecord} />
      <EntryDialog record={entry} onClose={closeEntry} />
      <ExperienceActionDialog
        action={action}
        context={context}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          void query.refetch();
        }}
      />
    </div>
  );
}

function restoreEntryFocus(key: string, attempt = 0): void {
  const trigger = [...document.querySelectorAll<HTMLButtonElement>('button[data-entry-trigger]')].find((candidate) => candidate.dataset.entryTrigger === key);
  trigger?.focus({ preventScroll: true });
  if (trigger !== undefined && document.activeElement !== trigger && attempt < 5) setTimeout(() => restoreEntryFocus(key, attempt + 1), 50);
}

function readView(value: string | null): CommerceView {
  return views.some((view) => view.key === value) ? (value as CommerceView) : 'all';
}

function matchesView(row: Experience, view: CommerceView): boolean {
  if (view === 'published') return row.publishedSequence !== null;
  if (view === 'drafts') return row.headSequence !== null && row.headSequence !== row.publishedSequence;
  if (view === 'attention') return needsAttention(row);
  return true;
}

function searchable(row: Experience): string {
  return `${row.name} ${row.code} ${row.publicSlug} ${row.mallId} ${row.entry.url}`.toLowerCase();
}

function boundaryMessage(mode: CommerceWorkspaceMode): string {
  if (mode === 'management') return '服务端在一个事务中建立独立商城、应用、初始草稿与专属商品池，失败时整体回滚。';
  if (mode === 'design') return '保存、校验、发布与恢复均使用独立 Operation 和 expectedVersion，失败版本不会污染已发布版本。';
  return '平台可查看准入与异常，但正式审批必须进入系统治理并与商户权限隔离。';
}

function clearFilters(search: URLSearchParams, setSearch: ReturnType<typeof useSearchParams>[1]) {
  const next = new URLSearchParams(search);
  next.delete('q');
  next.delete('view');
  next.delete('cursor');
  next.delete('selected');
  setSearch(next);
}
