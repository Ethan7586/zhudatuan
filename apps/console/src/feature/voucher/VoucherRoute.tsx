import { chineseReference, chineseSectionLabel, queryCondition, presentError, safeQueryError } from '@shop/presentation';
import { Button, ResourcePanel } from '@shop/design';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';

import { pageCursor } from '../../shared/url/PageCursor';
import { CardLibraryCreator, VoucherProgramCreator, VoucherRecordDrawer, type VoucherProgramDraft } from './VoucherDialogs';
import { voucherLifecycle, voucherStateLabel, voucherSummary, voucherViewMeta } from './VoucherPresentation';
import { createCardLibrary, createVoucherProgram, readVouchers, voucherKey, voucherViews } from './VoucherQuery';
import type { VoucherRecord, VoucherView } from './VoucherSchema';
import { VoucherTable } from './VoucherTable';
import { useRouteTitle } from '../../shared/ui/RouteTitle';
import './Workspace.css';
import './Table.css';
import './Dialogs.css';
import './Responsive.css';

export function Component() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const routeTitle = useRouteTitle('卡券中心');
  const [search, setSearch] = useSearchParams();
  const [creator, setCreator] = useState<'program' | 'library' | null>(null);
  const view = readView(search, context.session.capabilities);
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({
    queryKey: voucherKey(context, view, cursor),
    queryFn: ({ signal }) => readVouchers(context, view, cursor, signal),
    staleTime: 60_000,
  });
  const libraryCreator = useMutation({
    mutationFn: (prefix: string) => createCardLibrary(context, prefix),
    onSuccess: async () => {
      setCreator(null);
      const next = new URLSearchParams(search);
      next.set('view', 'libraries');
      next.delete('cursor');
      next.delete('q');
      next.delete('status');
      next.delete('selected');
      setSearch(next);
      await queryClient.invalidateQueries({ queryKey: voucherKey(context, 'libraries'), exact: true });
    },
  });
  const programCreator = useMutation({
    mutationFn: (draft: VoucherProgramDraft) => createVoucherProgram(context, draft),
    onSuccess: async () => {
      setCreator(null);
      const next = new URLSearchParams(search);
      next.set('view', 'programs');
      next.delete('cursor');
      next.delete('q');
      next.delete('status');
      next.delete('selected');
      setSearch(next);
      await queryClient.invalidateQueries({ queryKey: voucherKey(context, 'programs'), exact: true });
    },
  });
  const data = query.data;
  const error = safeQueryError(query.error);
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: data !== undefined,
    empty: false,
  });
  const q = (search.get('q') ?? '').trim().toLowerCase();
  const status = search.get('status') ?? 'all';
  const selectedId = search.get('selected') ?? undefined;
  const selected = data?.items.find((record) => record.id === selectedId);
  const canManagePrograms = context.session.capabilities.includes('voucher.programs.manage');
  const canCreateLibraries = context.session.capabilities.includes('voucher.cardlibraries.create');
  const states = useMemo(() => uniqueStates(data?.items ?? []), [data?.items]);
  const rows = useMemo(
    () =>
      (data?.items ?? []).filter((record) => {
        const matchesSearch = q === '' || `${record.name} ${record.id} ${record.detail}`.toLowerCase().includes(q);
        const matchesState = status === 'all' || record.state === status;
        return matchesSearch && matchesState;
      }),
    [data?.items, q, status]
  );
  const summary = useMemo(() => voucherSummary(view, data?.items ?? []), [data?.items, view]);

  const updateSearch = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(search);
      mutate(next);
      setSearch(next);
    },
    [search, setSearch]
  );
  const selectView = (nextView: VoucherView) =>
    updateSearch((next) => {
      next.set('view', nextView);
      next.delete('cursor');
      next.delete('q');
      next.delete('status');
      next.delete('selected');
    });
  const updateFilter = (key: 'q' | 'status', value: string) =>
    updateSearch((next) => {
      if (value === '' || value === 'all') next.delete(key);
      else next.set(key, value);
      next.delete('cursor');
      next.delete('selected');
    });
  const openRecord = useCallback(
    (record: VoucherRecord) => {
      setCreator(null);
      updateSearch((next) => next.set('selected', record.id));
    },
    [updateSearch]
  );
  const closeRecord = useCallback(() => updateSearch((next) => next.delete('selected')), [updateSearch]);
  const scopeName = context.scope.name ?? chineseReference('组织范围', context.scope.id);

  return (
    <div className="voucherworkspace" data-view={view}>
      <ResourcePanel
        title={routeTitle}
        eyebrow={chineseSectionLabel('卡券治理')}
        description="统一管理网站所有方的卡券方案、卡号资产、备券申请与发行批次。"
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
              isDisabled={!canManagePrograms}
              onPress={() => {
                closeRecord();
                libraryCreator.reset();
                programCreator.reset();
                setCreator('program');
              }}
            >
              新建卡券
            </Button>
          </>
        }
      >
        <div className="vouchercontent">
          <section className="voucherownership" role="note">
            <span aria-hidden="true">域</span>
            <div>
              <strong>当前网站归属：{scopeName}</strong>
              <p>卡券定义、卡号与发行记录按当前管理范围隔离；网站会员仅领取和使用，不进入本治理台。</p>
            </div>
          </section>

          <section className="vouchersummary" aria-label="当前卡券读模型摘要">
            {summary.map((metric) => (
              <article key={metric.label} className={`is-${metric.tone}`}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.hint}</small>
              </article>
            ))}
          </section>

          <section className="voucherboundarybanner" role="note">
            <span aria-hidden="true">!</span>
            <div>
              <strong>卡号库创建已启用</strong>
              <p>创建会经过双因素认证、范围校验、幂等和审计；审批、发行、暂停、作废与冲正仍按各自独立权限控制。</p>
            </div>
            <button
              type="button"
              disabled={!canCreateLibraries}
              onClick={() => {
                libraryCreator.reset();
                programCreator.reset();
                setCreator('library');
              }}
            >
              新建卡号库
            </button>
          </section>

          <ol className="voucherlifecycle" aria-label="卡券生命周期">
            {voucherLifecycle.map((item, index) => (
              <li key={item.key} className={`is-${item.key}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.role}</small>
                </div>
              </li>
            ))}
          </ol>

          <section className="voucherboard" aria-labelledby="voucherviewtitle">
            <nav className="vouchertabs" aria-label="卡券数据视图">
              {voucherViews.map((candidate) => (
                <button key={candidate} type="button" aria-pressed={candidate === view} onClick={() => selectView(candidate)}>
                  {voucherViewMeta[candidate].label}
                  {candidate === view && data !== undefined ? <span>{data.count}</span> : null}
                </button>
              ))}
            </nav>
            <div className="voucherfilterbar">
              <div className="voucherfiltercopy">
                <strong id="voucherviewtitle">{voucherViewMeta[view].label}</strong>
                <span>{voucherViewMeta[view].description}</span>
              </div>
              <label className="vouchersearch">
                <span className="sr-only">搜索当前卡券视图</span>
                <input type="search" value={search.get('q') ?? ''} onChange={(event) => updateFilter('q', event.target.value)} placeholder="搜索名称、编号或详情" />
              </label>
              <label className="voucherstatusfilter">
                <span className="sr-only">按状态筛选</span>
                <select value={status} onChange={(event) => updateFilter('status', event.target.value)}>
                  <option value="all">全部状态</option>
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {voucherStateLabel(state)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="voucherfiltermeta">
              当前页筛选 · 显示 {rows.length} / {data?.items.length ?? 0} 条 · 未并发读取其他卡券模型
            </p>
            {data !== undefined && data.items.length === 0 ? (
              <section className="voucherfilteredempty" role="status">
                <strong>暂无{voucherViewMeta[view].label}记录</strong>
                <p>当前网站范围尚未返回这一读模型的数据，可切换其他卡券视图。</p>
              </section>
            ) : null}
            {data !== undefined && data.items.length > 0 && rows.length === 0 ? (
              <section className="voucherfilteredempty" role="status">
                <strong>当前页没有匹配记录</strong>
                <p>调整搜索词或状态后即可恢复列表。</p>
                <button type="button" onClick={() => clearFilters(search, setSearch)}>
                  清除筛选
                </button>
              </section>
            ) : null}
            {rows.length === 0 ? null : <VoucherTable rows={rows} view={view} onOpen={openRecord} />}
            <footer className="voucherpagination">
              <span>本页 {data?.count ?? 0} 条 · 游标分页</span>
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
      <VoucherRecordDrawer record={selected} view={view} onClose={closeRecord} />
      <VoucherProgramCreator
        open={creator === 'program'}
        busy={programCreator.isPending}
        {...(programCreator.error === null ? {} : { error: presentError(programCreator.error).message })}
        onCreate={(draft) => programCreator.mutate(draft)}
        onClose={() => setCreator(null)}
      />
      <CardLibraryCreator
        open={creator === 'library'}
        busy={libraryCreator.isPending}
        {...(libraryCreator.error === null ? {} : { error: presentError(libraryCreator.error).message })}
        onCreate={(prefix) => libraryCreator.mutate(prefix)}
        onClose={() => setCreator(null)}
      />
    </div>
  );
}

function readView(search: URLSearchParams, capabilities: readonly string[]): VoucherView {
  const selected = search.get('view');
  if (voucherViews.includes(selected as VoucherView)) return selected as VoucherView;
  const available = (['programs', 'libraries', 'reserves', 'batches'] as const).find((view) => capabilities.includes(viewOperation[view]));
  return available ?? 'programs';
}

const viewOperation: Readonly<Record<VoucherView, string>> = Object.freeze({
  programs: 'voucher.programs.read',
  libraries: 'voucher.cardlibraries.read',
  reserves: 'voucher.reserves.read',
  batches: 'voucher.batches.read',
});

function uniqueStates(rows: readonly VoucherRecord[]): readonly string[] {
  return Object.freeze([...new Set(rows.map((row) => row.state))].sort());
}

function clearFilters(search: URLSearchParams, setSearch: ReturnType<typeof useSearchParams>[1]) {
  const next = new URLSearchParams(search);
  next.delete('q');
  next.delete('status');
  next.delete('cursor');
  next.delete('selected');
  setSearch(next);
}
