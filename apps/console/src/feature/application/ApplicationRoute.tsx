import { Button, ResourcePanel, ResourceState } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { pageCursor } from '../../shared/url/PageCursor';
import { ApplicationRecordDrawer, CommerceFlowPreview } from './ApplicationDialogs';
import { applicationSummary, commerceFlow, needsAttention } from './ApplicationPresentation';
import { applicationKey, readApplications } from './ApplicationQuery';
import type { Application } from './ApplicationSchema';
import { applicationScopePresentation, type CommerceWorkspaceMode } from './ApplicationScope';
import { ApplicationTable } from './ApplicationTable';
import { CommerceSolutionCenter, commerceSolutionName, readCommerceSolution, type CommerceSolutionId } from './CommerceSolutionCenter';
import './application-workspace.css';
import './application-table.css';
import './application-dialogs.css';
import './application-responsive.css';
import './commerce-solution-center.css';

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
  const [flowOpen, setFlowOpen] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const presentation = applicationScopePresentation(context.scope.kind);
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({
    queryKey: applicationKey(context, cursor),
    queryFn: ({ signal }) => readApplications(context, cursor, signal),
    staleTime: 60_000,
  });
  const data = query.data;
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: data !== undefined,
    empty: false,
    stale: query.isStale,
  });
  const error = safeQueryError(query.error);
  const view = readView(search.get('view'));
  const selectedSolution = readSolution(search);
  const q = (search.get('q') ?? '').trim().toLowerCase();
  const selectedId = search.get('selected') ?? undefined;
  const selected = data?.items.find((record) => record.id === selectedId);
  const rows = useMemo(() => (data?.items ?? []).filter((record) => matchesView(record, view)
    && (q === '' || searchable(record).includes(q))), [data?.items, q, view]);
  const summary = useMemo(() => applicationSummary(data?.items ?? []), [data?.items]);
  const flow = commerceFlow(presentation.mode);

  const updateSearch = useCallback((mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    mutate(next);
    setSearch(next);
  }, [search, setSearch]);
  const selectView = (nextView: CommerceView) => updateSearch((next) => {
    if (nextView === 'all') next.delete('view'); else next.set('view', nextView);
    next.delete('cursor'); next.delete('selected');
  });
  const updateQuery = (value: string) => updateSearch((next) => {
    if (value === '') next.delete('q'); else next.set('q', value);
    next.delete('cursor'); next.delete('selected');
  });
  const openRecord = useCallback((record: Application) => {
    setFlowOpen(false);
    setSolutionOpen(false);
    updateSearch((next) => next.set('selected', record.id));
  }, [updateSearch]);
  const closeRecord = useCallback(() => updateSearch((next) => next.delete('selected')), [updateSearch]);
  const scopeName = context.scope.name ?? context.scope.id;

  if (condition === 'unauthenticated' || condition === 'denied') {
    return <div className="commerceworkspace" data-mode={presentation.mode}>
      <ResourceState condition={condition} resourceLabel={presentation.title}
        {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}>
        <span />
      </ResourceState>
    </div>;
  }

  return <div className="commerceworkspace" data-mode={presentation.mode}>
    <ResourcePanel title={presentation.title} eyebrow={presentation.eyebrow} description={presentation.description}
      condition={condition} {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}
      actions={<><Button onPress={() => { closeRecord(); setFlowOpen(false); setSolutionOpen(true); }}>建店方案（3 套）</Button>
        <Button onPress={() => { void query.refetch(); }}>刷新数据</Button>
        <Button tone="primary" onPress={() => { closeRecord(); setSolutionOpen(false); setFlowOpen(true); }}>{presentation.primaryAction}</Button></>}>
      <div className="commercecontent">
        <section className="commerceownership" role="note"><span aria-hidden="true">域</span><div>
          <strong>{presentation.ownership}：{scopeName}</strong><p>{presentation.ownershipDetail}</p>
        </div><button className="commercevitheme" type="button" onClick={() => setSolutionOpen(true)}>
          预览方案 · {commerceSolutionName(selectedSolution)} <i aria-hidden="true">›</i></button></section>
        <section className="commercesummary" aria-label="商城与应用读模型摘要">
          {summary.map((metric) => <article key={metric.label} className={`is-${metric.tone}`}>
            <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.hint}</small>
          </article>)}
        </section>
        <section className="commerceboundarybanner" role="note"><span aria-hidden="true">!</span><div>
          <strong>{presentation.mode === 'management' ? '建店提交等待 mall.bootstrap' : '高风险写操作继续关闭'}</strong>
          <p>{boundaryMessage(presentation.mode)}</p>
        </div><button type="button" onClick={() => setFlowOpen(true)}>查看安全流程</button></section>
        <ol className="commerceflow" aria-label={`${presentation.title}业务闭环`}>
          {flow.map((step, index) => <li key={step.label}><span>{index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></li>)}
        </ol>
        <section className="commerceboard" aria-labelledby="commerceboardtitle">
          <nav className="commercetabs" aria-label="商城与应用状态视图">
            {views.map((candidate) => <button key={candidate.key} type="button" aria-pressed={candidate.key === view}
              onClick={() => selectView(candidate.key)}>{candidate.label}</button>)}
          </nav>
          <div className="commercefilterbar"><div><strong id="commerceboardtitle">商城应用清单</strong>
            <span>应用、绑定、草稿、校验与发布状态来自同一权威读模型</span></div>
            <label className="commercesearch"><span className="sr-only">搜索商城应用</span><input type="search" value={search.get('q') ?? ''}
              onChange={(event) => updateQuery(event.target.value)} placeholder="搜索名称、代码、商城或域名" /></label></div>
          <p className="commercefiltermeta">当前页筛选 · 显示 {rows.length} / {data?.items.length ?? 0} 条 · 不推断未返回的商城总量</p>
          {data !== undefined && data.items.length === 0 ? <section className="commerceempty" role="status"><strong>当前范围暂无商城应用</strong>
            <p>{presentation.mode === 'management' ? '可先查看六步建店流程；待 mall.bootstrap 补齐后再正式创建。' : '切换数据范围或刷新后再查看。'}</p></section> : null}
          {data !== undefined && data.items.length > 0 && rows.length === 0 ? <section className="commerceempty" role="status"><strong>当前页没有匹配记录</strong>
            <p>调整状态视图或搜索词即可恢复列表。</p><button type="button" onClick={() => clearFilters(search, setSearch)}>清除筛选</button></section> : null}
          {rows.length > 0 ? <ApplicationTable rows={rows} mode={presentation.mode} onOpen={openRecord} /> : null}
          <footer className="commercepagination"><span>服务端返回 {data?.count ?? 0} 条 · 游标分页</span>
            <Button onPress={() => { if (data?.nextCursor !== undefined) setSearch(pageCursor(search, data.nextCursor)); }}
              isDisabled={data?.nextCursor === undefined}>下一页</Button></footer>
        </section>
      </div>
    </ResourcePanel>
    <ApplicationRecordDrawer record={selected} onClose={closeRecord} />
    <CommerceFlowPreview open={flowOpen} presentation={presentation} onClose={() => setFlowOpen(false)} />
    <CommerceSolutionCenter open={solutionOpen} selected={selectedSolution}
      onSelect={(solution) => updateSearch((next) => { next.set('solution', solution); next.delete('theme'); })}
      onClose={() => setSolutionOpen(false)} />
  </div>;
}

function readView(value: string | null): CommerceView {
  return views.some((view) => view.key === value) ? value as CommerceView : 'all';
}

function readSolution(search: URLSearchParams): CommerceSolutionId {
  return readCommerceSolution(search.get('solution') ?? search.get('theme'));
}

function matchesView(row: Application, view: CommerceView): boolean {
  if (view === 'published') return row.published_sequence !== null && row.published_sequence !== undefined;
  if (view === 'drafts') return row.head_sequence !== null && row.head_sequence !== undefined && row.head_sequence !== row.published_sequence;
  if (view === 'attention') return needsAttention(row);
  return true;
}

function searchable(row: Application): string {
  return `${row.name} ${row.code} ${row.public_slug} ${row.mall_id ?? ''} ${row.pool_id ?? ''} ${row.domain ?? ''}`.toLowerCase();
}

function boundaryMessage(mode: CommerceWorkspaceMode): string {
  if (mode === 'management') return '服务端需原子建立商城、组织关系、商城应用、初始商品池和开店草稿；当前预览绝不分步写入。';
  if (mode === 'design') return '保存、校验、预览、发布与恢复需完整 expectedVersion / proof 旅程；当前页面只读取权威状态。';
  return '平台可查看准入与异常，但正式审批必须进入系统治理并与商户权限隔离。';
}

function clearFilters(search: URLSearchParams, setSearch: ReturnType<typeof useSearchParams>[1]) {
  const next = new URLSearchParams(search);
  next.delete('q'); next.delete('view'); next.delete('cursor'); next.delete('selected');
  setSearch(next);
}
