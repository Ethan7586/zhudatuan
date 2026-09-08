import {
  OP_REPORTING_CATEGORIES_READ,
  OP_REPORTING_CHANNELS_READ,
  OP_REPORTING_DIMENSIONS_READ,
  OP_REPORTING_EXPORTS_CREATE,
  OP_REPORTING_EXPORTS_READ,
  OP_REPORTING_MALLS_READ,
  OP_REPORTING_PRODUCTS_READ,
  OP_REPORTING_SALES_READ,
  OP_REPORTING_VOUCHERCONSUMPTION_READ,
} from '@shop/contract/ids';
import { PERM_REPORTING_EXPORT_MANAGE, PERM_REPORTING_EXPORT_READ } from '@shop/authz/ids';
import { chineseReference, type Receipt, presentError, queryCondition } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ReportingDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { pageCursor } from '../../../shared/query/QueryState';
import { reportPeriods, reportViews, type ReportFilter, type ReportPeriod, type ReportView } from '../model/Report';
import { dimensionsKey, exportKey, reportingKey } from './ReportingQueryKey';

const operations: Readonly<Record<ReportView, string>> = Object.freeze({
  sales: OP_REPORTING_SALES_READ,
  products: OP_REPORTING_PRODUCTS_READ,
  malls: OP_REPORTING_MALLS_READ,
  categories: OP_REPORTING_CATEGORIES_READ,
  channels: OP_REPORTING_CHANNELS_READ,
  members: OP_REPORTING_SALES_READ,
  voucher: OP_REPORTING_VOUCHERCONSUMPTION_READ,
});

export function useReportingViewModel(context: ConsoleContext, dependencies: ReportingDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const availableViews = useMemo(() => reportViews.filter((view) => context.session.capabilities.includes(operations[view])), [context.session.capabilities]);
  const view = validView(search.get('view'), availableViews);
  const period = validPeriod(search.get('period'));
  const application = search.get('application') ?? '';
  const filter: ReportFilter = Object.freeze({ view, period, ...(application ? { application } : {}), ...(search.get('cursor') ? { cursor: search.get('cursor')! } : {}) });
  const canReadDimensions = context.session.capabilities.includes(OP_REPORTING_DIMENSIONS_READ);
  const dimensions = useQuery({ queryKey: dimensionsKey(context), queryFn: ({ signal }) => dependencies.dimensions.execute(context, signal), enabled: canReadDimensions });
  const query = useQuery({ queryKey: reportingKey(context, filter), queryFn: ({ signal }) => dependencies.read.execute(context, filter, signal) });
  const [exportOpen, setExportOpen] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [exportId, setExportId] = useState<string>();
  const [receipt, setReceipt] = useState<Receipt>();
  const filterIdentity = `${context.scope.kind}:${context.scope.id}:${context.session.accessVersion}:${view}:${period}:${application}`;
  useEffect(() => {
    setIdentity(dependencies.createIdentity());
    setExportId(undefined);
    setReceipt(undefined);
    setExportOpen(false);
  }, [dependencies, filterIdentity]);
  const data = query.data;
  const create = useMutation({
    mutationFn: (commandIdentity: string) => {
      if (!data) throw new Error('请等待当前报表加载完成后再导出。');
      return dependencies.export.execute(context, filter, data.snapshot, commandIdentity);
    },
    onSuccess: (job) => setExportId(job.id),
  });
  const exported = useQuery({
    queryKey: exportKey(context, exportId ?? 'pending'),
    queryFn: ({ signal }) => dependencies.readExport.execute(context, exportId!, signal),
    enabled: exportId !== undefined,
    refetchInterval: (result) => (result.state.data?.state === 'queued' || result.state.data?.state === 'running' ? 1500 : false),
  });
  useEffect(() => {
    const job = exported.data;
    if (job?.state !== 'completed' || job.scanState !== 'clean' || !job.download || receipt?.requestId === identity) return;
    setReceipt(Object.freeze({ requestId: identity, reference: chineseReference('导出任务', job.id), occurredAt: job.generatedAt ?? job.createdAt, message: `安全导出已生成，共 ${job.recordCount} 条；下载链接将在服务端指定时间失效。` }));
  }, [exported.data, identity, receipt?.requestId]);
  const rows = useMemo(() => data?.items ?? [], [data?.items]);
  const watermark = data?.snapshot.watermark.occurredAt;
  const timezone = rows[0]?.period.timezone ?? 'Asia/Shanghai';
  const projectionVersion = rows.reduce((maximum, row) => Math.max(maximum, row.projectionVersion), 0);
  const stale = watermark === undefined ? false : Date.now() - new Date(watermark).getTime() > (period === 'realtime' ? 15 * 60_000 : 36 * 60 * 60_000);
  const update = (key: 'view' | 'period' | 'application', value: string) => {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('cursor');
    setSearch(next);
  };
  const canExport =
    context.session.permissions.includes(PERM_REPORTING_EXPORT_MANAGE) &&
    context.session.permissions.includes(PERM_REPORTING_EXPORT_READ) &&
    context.session.capabilities.includes(OP_REPORTING_EXPORTS_CREATE) &&
    context.session.capabilities.includes(OP_REPORTING_EXPORTS_READ) &&
    data !== undefined;
  return Object.freeze({
    view,
    period,
    application,
    availableViews,
    rows,
    preset: view === 'members' ? dimensions.data?.presets.find(({ code }) => code === 'customermember') : undefined,
    dimensions: Object.freeze({
      applications: dimensions.data?.applications ?? [],
      pending: canReadDimensions && dimensions.isPending,
      error: dimensions.error ? presentError(dimensions.error).message : canReadDimensions ? undefined : '当前账号无权读取商城应用筛选项。',
    }),
    count: data?.count ?? 0,
    nextCursor: data?.nextCursor,
    watermark,
    timezone,
    projectionVersion,
    stale,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: rows.length === 0 }),
    error: query.error ? presentError(query.error).message : undefined,
    export: Object.freeze({
      open: exportOpen,
      allowed: canExport,
      pending: create.isPending,
      job: exported.data,
      error: create.error ? presentError(create.error).message : exported.error ? presentError(exported.error).message : undefined,
    }),
    receipt,
    actions: Object.freeze({
      refresh: () => void query.refetch(),
      view: (value: ReportView) => update('view', value),
      period: (value: ReportPeriod) => update('period', value),
      application: (value: string) => update('application', value),
      refreshDimensions: () => void dimensions.refetch(),
      next: () => {
        if (data?.nextCursor) setSearch(pageCursor(search, data.nextCursor));
      },
      openExport: () => {
        if (context.session.assurance.level < 3) requestStepup();
        else setExportOpen(true);
      },
      closeExport: () => setExportOpen(false),
      submitExport: () => {
        if (!create.isPending) create.mutate(identity);
      },
      retryExport: () => {
        if (create.isPending) return;
        if (create.error) create.mutate(identity);
        else void exported.refetch();
      },
      restartExport: () => {
        if (create.isPending) return;
        const nextIdentity = dependencies.createIdentity();
        setIdentity(nextIdentity);
        setExportId(undefined);
        setReceipt(undefined);
        create.reset();
        create.mutate(nextIdentity);
      },
      refreshDownload: () => void exported.refetch(),
      dismissReceipt: () => setReceipt(undefined),
    }),
  });
}

export type ReportingViewModel = ReturnType<typeof useReportingViewModel>;

function validView(value: string | null, available: readonly ReportView[]): ReportView {
  return available.includes(value as ReportView) ? (value as ReportView) : (available[0] ?? 'sales');
}
function validPeriod(value: string | null): ReportPeriod {
  return reportPeriods.includes(value as ReportPeriod) ? (value as ReportPeriod) : '30days';
}
