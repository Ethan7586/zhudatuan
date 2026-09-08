import type { ExportFilterValue, ExportReport } from '../model/ExportJob';
import type { ReportDimension, ReportPeriod } from '../model/Metric';
import type { ReportQuery } from '../model/ReportSnapshot';

const dimensions = Object.freeze({
  sales: 'sales',
  products: 'product',
  malls: 'mall',
  categories: 'category',
  channels: 'channel',
  members: 'member',
  voucher: 'voucher',
} as const satisfies Readonly<Record<string, ReportDimension>>);

const periods = new Set<ReportPeriod>(['realtime', 'yesterday', '7days', '30days']);
const orderKeys = new Set(['search', 'view', 'placed', 'from', 'to', 'lifecycle', 'payment', 'fulfillment', 'mall', 'channel', 'product', 'memberIds', 'minimumMinor', 'maximumMinor', 'timezone']);
const financeKeys = new Set(['periodStart', 'periodEnd', 'currency', 'state']);
const orderChoices = Object.freeze({
  view: new Set(['unpaid', 'unshipped', 'active', 'completed', 'exception']),
  placed: new Set(['today', '7days', '30days']),
  lifecycle: new Set(['awaitingpayment', 'paid', 'processing', 'completed', 'cancelled']),
  payment: new Set(['unpaid', 'authorizing', 'paid', 'failed', 'partially_refunded', 'refunded']),
  fulfillment: new Set(['unallocated', 'allocated', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']),
} as const);

export function exportFilter(report: ExportReport, value: unknown): Readonly<Record<string, ExportFilterValue>> {
  const source = record(value);
  if (report === 'metrics') {
    exact(source, new Set(['view', 'period', 'application']));
    const view = text(source.view, 32);
    const period = text(source.period, 32) as ReportPeriod;
    if (!(view in dimensions) || !periods.has(period)) throw new Error('REPORT_FILTER_INVALID');
    const application = source.application === undefined ? undefined : text(source.application, 100);
    return Object.freeze({ view, period, ...(application ? { application } : {}) });
  }
  exact(source, report === 'orders' ? orderKeys : financeKeys);
  validateProjectionFilter(report, source);
  return Object.freeze({ ...source }) as Readonly<Record<string, ExportFilterValue>>;
}

export function metricExportQuery(scope: string, filter: Readonly<Record<string, ExportFilterValue>>): ReportQuery {
  const view = text(filter.view, 32);
  const period = text(filter.period, 32) as ReportPeriod;
  const dimension = dimensions[view as keyof typeof dimensions];
  if (!scope || !dimension || !periods.has(period)) throw new Error('REPORT_FILTER_INVALID');
  const application = filter.application === undefined ? null : text(filter.application, 100);
  return Object.freeze({ scope, dimension, period, application });
}

function validateProjectionFilter(report: Exclude<ExportReport, 'metrics'>, source: Readonly<Record<string, unknown>>): void {
  for (const [key, value] of Object.entries(source)) {
    if (report === 'orders' && key === 'memberIds') {
      if (!Array.isArray(value) || value.length > 10_000 || value.some((item) => typeof item !== 'string' || !item || item.length > 255)) throw new Error('REPORT_FILTER_INVALID');
    } else if (report === 'orders' && (key === 'minimumMinor' || key === 'maximumMinor')) {
      if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('REPORT_FILTER_INVALID');
    } else if (typeof value !== 'string' || !value || value.length > 255) {
      throw new Error('REPORT_FILTER_INVALID');
    }
  }
  if (report === 'orders') {
    const minimum = source.minimumMinor;
    const maximum = source.maximumMinor;
    if (typeof minimum === 'number' && typeof maximum === 'number' && minimum > maximum) throw new Error('REPORT_FILTER_INVALID');
    for (const [key, allowed] of Object.entries(orderChoices)) {
      if (source[key] !== undefined && !allowed.has(source[key] as string)) throw new Error('REPORT_FILTER_INVALID');
    }
    for (const key of ['from', 'to'] as const) if (source[key] !== undefined && !isoTime(source[key])) throw new Error('REPORT_FILTER_INVALID');
    if (typeof source.from === 'string' && typeof source.to === 'string' && source.from >= source.to) throw new Error('REPORT_FILTER_INVALID');
    if (source.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: source.timezone as string }).format();
      } catch {
        throw new Error('REPORT_FILTER_INVALID');
      }
    }
  } else {
    if (source.currency !== undefined && !/^[A-Z]{3}$/.test(source.currency as string)) throw new Error('REPORT_FILTER_INVALID');
    if (source.state !== undefined && !['draft', 'final'].includes(source.state as string)) throw new Error('REPORT_FILTER_INVALID');
    for (const key of ['periodStart', 'periodEnd'] as const) if (source[key] !== undefined && !date(source[key])) throw new Error('REPORT_FILTER_INVALID');
    if (typeof source.periodStart === 'string' && typeof source.periodEnd === 'string' && source.periodStart > source.periodEnd) throw new Error('REPORT_FILTER_INVALID');
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 16_384) throw new Error('REPORT_FILTER_INVALID');
  return value as Readonly<Record<string, unknown>>;
}

function exact(value: Readonly<Record<string, unknown>>, keys: ReadonlySet<string>): void {
  if (Object.keys(value).some((key) => !keys.has(key))) throw new Error('REPORT_FILTER_INVALID');
}

function text(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) throw new Error('REPORT_FILTER_INVALID');
  return value.trim();
}

function isoTime(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function date(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().startsWith(value);
}
