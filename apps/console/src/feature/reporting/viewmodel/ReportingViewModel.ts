import { type Receipt, presentError, queryCondition } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ReportingDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { pageCursor } from '../../../shared/url/PageCursor';
import { reportPeriods, reportViews, type ReportFilter, type ReportPeriod, type ReportView } from '../model/Report';
import { exportKey, reportingKey } from './ReportingQueryKey';

const operations: Readonly<Record<ReportView, string>> = Object.freeze({ sales: 'reporting.sales.read', products: 'reporting.products.read', malls: 'reporting.malls.read', categories: 'reporting.categories.read', channels: 'reporting.channels.read', voucher: 'reporting.voucherconsumption.read' });

export function useReportingViewModel(context: ConsoleContext, dependencies: ReportingDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const availableViews = useMemo(() => reportViews.filter((view) => context.session.capabilities.includes(operations[view])), [context.session.capabilities]);
  const view = validView(search.get('view'), availableViews);
  const period = validPeriod(search.get('period'));
  const application = search.get('application') ?? '';
  const [applicationDraft, setApplicationDraft] = useState(application);
  const filter: ReportFilter = Object.freeze({ view, period, ...(application ? { application } : {}), ...(search.get('cursor') ? { cursor: search.get('cursor')! } : {}) });
  useEffect(() => setApplicationDraft(application), [application]);
  const query = useQuery({ queryKey: reportingKey(context, filter), queryFn: ({ signal }) => dependencies.read.execute(context, filter, signal) });
  const [exportOpen, setExportOpen] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [exportId, setExportId] = useState<string>();
  const [receipt, setReceipt] = useState<Receipt>();
  const filterIdentity = `${view}:${period}:${application}`;
  useEffect(() => { setIdentity(dependencies.createIdentity()); setExportId(undefined); setReceipt(undefined); setExportOpen(false); }, [dependencies, filterIdentity]);
  const create = useMutation({ mutationFn: () => dependencies.export.execute(context, filter, identity), onSuccess: (job) => setExportId(job.id) });
  const exported = useQuery({ queryKey: exportKey(context, exportId ?? 'pending'), queryFn: ({ signal }) => dependencies.readExport.execute(context, exportId!, signal), enabled: exportId !== undefined, refetchInterval: (result) => result.state.data?.state === 'queued' || result.state.data?.state === 'running' ? 1500 : false });
  useEffect(() => { const job = exported.data; if (job?.state !== 'completed' || receipt?.reference === job.id) return; setReceipt(Object.freeze({ requestId: identity, reference: job.id, occurredAt: job.generatedAt ?? new Date().toISOString(), message: `安全导出已生成，共 ${job.recordCount} 条；下载链接将在服务端指定时间失效。` })); }, [exported.data, identity, receipt?.reference]);
  const data = query.data;
  const rows = data?.items ?? [];
  const watermark = useMemo(() => latest(rows.map((row) => row.watermark)), [rows]);
  const timezone = rows[0]?.period.timezone ?? 'Asia/Shanghai';
  const projectionVersion = rows.reduce((maximum, row) => Math.max(maximum, row.projectionVersion), 0);
  const stale = watermark === undefined ? false : Date.now() - new Date(watermark).getTime() > (period === 'realtime' ? 15 * 60_000 : 36 * 60 * 60_000);
  const update = (key: 'view' | 'period' | 'application', value: string) => { const next = new URLSearchParams(search); value ? next.set(key, value) : next.delete(key); next.delete('cursor'); setSearch(next); };
  const canExport = context.session.permissions.includes('reporting.export.manage') && context.session.permissions.includes('reporting.export.read') && context.session.capabilities.includes('reporting.exports.create') && context.session.capabilities.includes('reporting.exports.read');
  return Object.freeze({
    view, period, applicationDraft, availableViews, rows, count: data?.count ?? 0, nextCursor: data?.nextCursor, watermark, timezone, projectionVersion, stale,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: rows.length === 0 }), error: query.error ? presentError(query.error).message : undefined,
    export: Object.freeze({ open: exportOpen, allowed: canExport, pending: create.isPending, job: exported.data, error: create.error ? presentError(create.error).message : exported.error ? presentError(exported.error).message : undefined }), receipt,
    actions: Object.freeze({
      refresh: () => void query.refetch(), view: (value: ReportView) => update('view', value), period: (value: ReportPeriod) => update('period', value), application: setApplicationDraft, applyApplication: () => update('application', applicationDraft.trim()),
      next: () => { if (data?.nextCursor) setSearch(pageCursor(search, data.nextCursor)); },
      openExport: () => { if (context.session.assurance.level < 3) requestStepup(); else setExportOpen(true); }, closeExport: () => setExportOpen(false), submitExport: () => { if (!create.isPending) create.mutate(); }, retryExport: () => { if (!create.isPending) create.mutate(); }, dismissReceipt: () => setReceipt(undefined),
    }),
  });
}

export type ReportingViewModel = ReturnType<typeof useReportingViewModel>;

function validView(value: string | null, available: readonly ReportView[]): ReportView { return available.includes(value as ReportView) ? value as ReportView : available[0] ?? 'sales'; }
function validPeriod(value: string | null): ReportPeriod { return reportPeriods.includes(value as ReportPeriod) ? value as ReportPeriod : '30days'; }
function latest(values: readonly string[]): string | undefined { return values.length === 0 ? undefined : [...values].sort().at(-1); }
