import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { encodeCursor, queryPage } from '../../../../foundation/interface/Validation';
import type { ReportDimension, ReportPeriod } from '../../domain/model/Metric';
import type { ReportRepository } from '../port/ReportRepository';

export class MetricReader {
  constructor(private readonly reports: ReportRepository) {}

  async read<TKey extends MetricOperation>(operation: TKey, input: OperationInputFor<TKey>, context: HandlerContext<TKey>, scope: string, dimension: ReportDimension | null): Promise<OperationReply<OperationOutputFor<TKey>>> {
    if (context.operation !== operation) throw new Error('REPORT_OPERATION_MISMATCH');
    const page = queryPage(input);
    const selectedPeriod = period(queryText(input.query, 'period'));
    const application = queryText(input.query, 'applicationid');
    const rows = await this.reports.metrics(context.transaction, {
      scope,
      dimension,
      period: selectedPeriod,
      application,
      cursorTime: page.sort,
      cursorId: page.id,
      fetch: page.fetch,
    });
    const more = rows.length > page.limit;
    const visible = more ? rows.slice(0, page.limit) : rows;
    const last = visible.at(-1);
    const items = visible.map(({ cursorTime: _time, cursorId: _id, ...metric }) => metric);
    const nextCursor = more && last ? encodeCursor({ sort: last.cursorTime, id: last.cursorId }) : undefined;
    const summary = dimension === null ? await this.reports.cockpit(context.transaction, scope) : undefined;
    const body = { items, count: items.length, ...(nextCursor ? { nextCursor } : {}), ...(summary === undefined ? {} : { summary }) };
    return { status: 200, body: body as OperationOutputFor<TKey> };
  }
}

export type MetricOperation =
  | 'reporting.dashboard.read'
  | 'reporting.sales.read'
  | 'reporting.products.read'
  | 'reporting.malls.read'
  | 'reporting.categories.read'
  | 'reporting.channels.read'
  | 'reporting.powderclass.read'
  | 'reporting.voucherconsumption.read';

function period(value: string | null): ReportPeriod {
  if (value === null || value === 'realtime') return 'realtime';
  if (value === 'yesterday' || value === '7days' || value === '30days') return value;
  throw new Error('REPORT_PERIOD_INVALID');
}

function queryText(query: Readonly<Record<string, unknown>> | undefined, name: string): string | null {
  const raw = query?.[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > 100) throw new Error('REPORT_FILTER_INVALID');
  return value;
}
