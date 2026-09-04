import type { ReportingPort } from '../port/ReportingPort';
import { projectedMetric, type ProjectionEvent } from '../../domain/model/Projection';
import type { MetricContribution } from '../../domain/model/Metric';
import { PROJECTION_EVENTS } from '../../../../generated/EventSubscriptions';
import { COMMERCE_EVENTS } from '@shop/contract';

const eventVersions = new Map<string, number>(COMMERCE_EVENTS.map(event => [event.type, event.version]));

export class ProjectEvent {
  constructor(private readonly repository: ReportingPort) {}

  async execute(event: ProjectionEvent): Promise<readonly Readonly<{ scope: string; version: number }>[]> {
    const affected = new Set([event.scope]);
    const expectedVersion = eventVersions.get(event.type);
    if (expectedVersion !== undefined && event.version !== expectedVersion) throw new Error(`REPORT_EVENT_VERSION_UNSUPPORTED:${event.type}:${event.version}`);
    if (event.type === 'order.export.requested' || event.type === 'finance.export.requested') await this.repository.createRequestedExport(event);
    else if (event.type === 'order.placed') await this.placed(event, affected);
    else if (event.type === 'order.paid') await this.paid(event, affected);
    else if (event.type === 'order.cancelled') await this.cancelled(event);
    else if (event.type === 'fulfillment.shipped') await this.shipped(event);
    else if (event.type === 'refund.completed') await this.refunded(event, affected);
    else if (event.type === 'voucher.redeemed' || event.type === 'voucher.refunded') await this.voucher(event, affected);
    else if (event.type === 'finance.period.closed') await this.statement(event);
    else if (!PROJECTION_EVENTS.has(event.type)) throw new Error(`REPORT_EVENT_MAPPING_MISSING:${event.type}`);
    return this.repository.completeEvent(event, [...affected]);
  }

  private async placed(event: ProjectionEvent, affected: Set<string>): Promise<void> {
    const payload = event.payload;
    const mall = text(payload.mall, 'REPORT_MALL_REQUIRED');
    const scopeSnapshot = scopes(payload.scopes, mall);
    scopeSnapshot.forEach((scope) => affected.add(scope));
    await this.repository.createOrder({
      sourceEvent: event.id,
      order: text(payload.order, 'REPORT_ORDER_REQUIRED'),
      scopes: scopeSnapshot,
      number: text(payload.number, 'REPORT_ORDER_NUMBER_REQUIRED'),
      totalMinor: integer(payload.totalMinor, 'REPORT_AMOUNT_INVALID'),
      currency: text(payload.currency, 'REPORT_CURRENCY_REQUIRED'),
      occurredAt: event.occurredAt,
      snapshot: payload,
    });
  }

  private async paid(event: ProjectionEvent, affected: Set<string>): Promise<void> {
    const payload = event.payload;
    const snapshot = object(payload.snapshot, 'REPORT_ORDER_SNAPSHOT_REQUIRED');
    const mall = text(snapshot.mall, 'REPORT_MALL_REQUIRED');
    const timezone = text(snapshot.timezone, 'REPORT_TIMEZONE_REQUIRED');
    const application = text(snapshot.application, 'REPORT_APPLICATION_REQUIRED');
    const member = text(payload.member ?? snapshot.member, 'REPORT_MEMBER_REQUIRED');
    const amount = integer(payload.amountMinor, 'REPORT_AMOUNT_INVALID');
    const currency = text(payload.currency, 'REPORT_CURRENCY_REQUIRED');
    const period = await this.repository.period(event.occurredAt, timezone);
    const range = { ...period, timezone };
    const scopeSnapshot = scopes(snapshot.scopes, mall);
    const metrics: MetricContribution[] = [];
    scopeSnapshot.forEach((scope) => affected.add(scope));
    for (const scope of scopeSnapshot) {
      metrics.push(
        projectedMetric('sales.amount', scope, range, { mall, application }, amount, 'minor', currency, event.occurredAt),
        projectedMetric('sales.orders', scope, range, { mall, application }, 1, 'count', null, event.occurredAt),
        projectedMetric('mall.amount', scope, range, { mall, application }, amount, 'minor', currency, event.occurredAt),
        projectedMetric('member.amount', scope, range, { customer: scope, member, mall, application }, amount, 'minor', currency, event.occurredAt),
        projectedMetric('member.orders', scope, range, { customer: scope, member, mall, application }, 1, 'count', null, event.occurredAt)
      );
    }
    const lines = array(snapshot.lines, 'REPORT_LINES_REQUIRED').map((line) => object(line, 'REPORT_LINE_INVALID'));
    for (const line of lines) {
      for (const scope of lineScopes(scopeSnapshot, line.partner)) {
        affected.add(scope);
        metrics.push(...this.line(scope, mall, application, range, line, currency, event.occurredAt));
      }
    }
    await this.repository.addMetrics(metrics, event.id);
    await this.repository.payOrder(text(payload.order, 'REPORT_ORDER_REQUIRED'), amount, currency, snapshot, event.occurredAt, event.id);
  }

  private line(scope: string, mall: string, application: string, period: Readonly<{ from: string; to: string; timezone: string }>, line: Readonly<Record<string, unknown>>, currency: string, watermark: string): readonly MetricContribution[] {
    const amount = integer(line.payableMinor, 'REPORT_LINE_AMOUNT_INVALID');
    const common = { mall, application };
    return Object.freeze([
      projectedMetric('product.amount', scope, period, { ...common, product: text(line.product, 'REPORT_PRODUCT_REQUIRED') }, amount, 'minor', currency, watermark),
      projectedMetric('category.amount', scope, period, { ...common, category: text(line.category, 'REPORT_CATEGORY_REQUIRED') }, amount, 'minor', currency, watermark),
      projectedMetric('channel.amount', scope, period, { ...common, channel: typeof line.provider === 'string' && line.provider ? line.provider : 'internal' }, amount, 'minor', currency, watermark),
    ]);
  }

  private async cancelled(event: ProjectionEvent): Promise<void> {
    await this.repository.cancelOrder(text(event.payload.order, 'REPORT_ORDER_REQUIRED'), event.occurredAt, event.id);
  }

  private async shipped(event: ProjectionEvent): Promise<void> {
    await this.repository.shipOrder(text(event.payload.order, 'REPORT_ORDER_REQUIRED'), text(event.payload.state, 'REPORT_SHIPMENT_STATE_REQUIRED'), event.occurredAt, event.id);
  }

  private async refunded(event: ProjectionEvent, affected: Set<string>): Promise<void> {
    const payload = event.payload;
    const mall = text(payload.mall ?? payload.scope, 'REPORT_MALL_REQUIRED');
    const timezone = text(payload.timezone, 'REPORT_TIMEZONE_REQUIRED');
    const period = await this.repository.period(event.occurredAt, timezone);
    const range = { ...period, timezone };
    const amount = integer(payload.amountMinor, 'REPORT_REFUND_AMOUNT_INVALID');
    const currency = text(payload.currency, 'REPORT_CURRENCY_REQUIRED');
    const application = await this.repository.orderApplication(text(payload.order, 'REPORT_ORDER_REQUIRED'));
    const metrics: MetricContribution[] = [];
    for (const scope of scopes(payload.scopes, mall)) {
      affected.add(scope);
      metrics.push(projectedMetric('refund.amount', scope, range, { mall, application }, amount, 'minor', currency, event.occurredAt), projectedMetric('refund.orders', scope, range, { mall, application }, 1, 'count', null, event.occurredAt));
    }
    await this.repository.addMetrics(metrics, event.id);
  }

  private async voucher(event: ProjectionEvent, affected: Set<string>): Promise<void> {
    const payload = event.payload;
    const owner = text(payload.scope, 'REPORT_VOUCHER_SCOPE_REQUIRED');
    if (owner !== event.scope) throw new Error('REPORT_VOUCHER_SCOPE_INVALID');
    const store = payload.store === null ? null : text(payload.store, 'REPORT_STORE_REQUIRED');
    const channel = text(payload.channel, 'REPORT_VOUCHER_CHANNEL_REQUIRED');
    if (!['order', 'store', 'manual'].includes(channel) || (channel === 'store' && store === null)) throw new Error('REPORT_VOUCHER_CHANNEL_INVALID');
    const timezone = text(payload.timezone, 'REPORT_TIMEZONE_REQUIRED');
    const period = await this.repository.period(event.occurredAt, timezone);
    const range = { ...period, timezone };
    const amount = integer(payload.amountMinor, 'REPORT_VOUCHER_AMOUNT_INVALID');
    const metrics: MetricContribution[] = [];
    const currency = text(payload.currency, 'REPORT_CURRENCY_REQUIRED');
    const refund = event.type === 'voucher.refunded';
    const dimensions: Readonly<Record<string, string>> = { voucherScope: owner, channel, currency, ...(store ? { store } : {}) };
    for (const scope of scopes(payload.scopes, owner, ...(store ? [store] : []))) {
      affected.add(scope);
      metrics.push(projectedMetric(refund ? 'voucher.refund.amount' : 'voucher.amount', scope, range, dimensions, amount, 'minor', currency, event.occurredAt),
        projectedMetric(refund ? 'voucher.refunds' : 'voucher.redemptions', scope, range, dimensions, 1, 'count', null, event.occurredAt));
    }
    await this.repository.addMetrics(metrics, event.id);
  }

  private async statement(event: ProjectionEvent): Promise<void> {
    const statement = object(event.payload.statementSnapshot, 'REPORT_STATEMENT_SNAPSHOT_REQUIRED');
    await this.repository.saveStatement(event.scope, statement, event.occurredAt, event.id);
  }
}

function object(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}
function array(value: unknown, code: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(code);
  return value;
}
function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value || value.length > 255) throw new Error(code);
  return value;
}
function integer(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}
function scopes(value: unknown, ...required: string[]): readonly string[] {
  if (!Array.isArray(value) || value.some((scope) => typeof scope !== 'string' || !scope)) throw new Error('REPORT_AUTHORIZATION_SNAPSHOT_REQUIRED');
  return Object.freeze([...new Set([...(value as string[]), ...required])]);
}
function lineScopes(scoped: readonly string[], partner: unknown): readonly string[] {
  return Object.freeze([...new Set([...scoped, ...(typeof partner === 'string' && partner ? [partner] : [])])]);
}
