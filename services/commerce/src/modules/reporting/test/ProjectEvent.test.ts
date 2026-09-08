import { describe, expect, it } from 'vitest';
import type { ReportingPort } from '../application/port/ReportingPort';
import type { ExportJob, ExportReport, ExportRow } from '../domain/model/ExportJob';
import type { MetricContribution } from '../domain/model/Metric';
import type { OrderProjection, ProjectionEvent } from '../domain/model/Projection';
import { ProjectEvent } from '../application/service/ProjectEvent';

class MemoryReporting implements ReportingPort {
  readonly projected: MetricContribution[] = [];
  readonly completed: ProjectionEvent[] = [];
  paid: Readonly<{ order: string; amount: number }> | null = null;

  createRequestedExport(): Promise<void> {
    return Promise.resolve();
  }
  claimEvent(): Promise<ProjectionEvent | null> {
    return Promise.resolve(null);
  }
  period(_occurredAt: string, timezone: string) {
    return Promise.resolve({ from: '2026-08-21T00:00:00Z', to: '2026-08-22T00:00:00Z', timezone });
  }
  addMetrics(metrics: readonly MetricContribution[], _event: string): Promise<void> {
    this.projected.push(...metrics);
    return Promise.resolve();
  }
  orderApplication(): Promise<string> {
    return Promise.resolve('application:1');
  }
  createOrder(_projection: OrderProjection): Promise<void> {
    return Promise.resolve();
  }
  payOrder(order: string, amountMinor: number): Promise<void> {
    this.paid = { order, amount: amountMinor };
    return Promise.resolve();
  }
  cancelOrder(): Promise<void> {
    return Promise.resolve();
  }
  shipOrder(): Promise<void> {
    return Promise.resolve();
  }
  saveStatement(): Promise<void> {
    return Promise.resolve();
  }
  completeEvent(event: ProjectionEvent, scopes: readonly string[]) {
    this.completed.push(event);
    return Promise.resolve(scopes.map((scope) => ({ scope, version: 1 })));
  }
  claimExport(): Promise<ExportJob | null> {
    return Promise.resolve(null);
  }
  exportRows(_id: string, _report: ExportReport, _cursor: string | null, _fetch: number): Promise<readonly ExportRow[]> {
    return Promise.resolve([]);
  }
  exportCount(): Promise<number | null> {
    return Promise.resolve(null);
  }
  advanceExport(): Promise<void> {
    return Promise.resolve();
  }
  completeExport(): Promise<void> {
    return Promise.resolve();
  }
  failExport(): Promise<void> {
    return Promise.resolve();
  }
}

describe('reporting event projection', () => {
  it.each([
    ['order', null, 'order:one', ['mall:1', 'group:1']],
    ['store', 'store:1', null, ['mall:1', 'group:1', 'store:1']],
    ['manual', null, null, ['mall:1', 'group:1']],
  ] as const)('projects %s voucher refund separately from gross redemptions using its frozen scopes and currency', async (channel, store, order, scopes) => {
    const repository = new MemoryReporting();
    const event: ProjectionEvent = {
      id: 'event:voucher:refund',
      type: 'voucher.refunded',
      version: 1,
      aggregate: 'voucher:1',
      scope: 'mall:1',
      occurredAt: '2026-09-06T10:00:00Z',
      payload: { voucher: 'voucher:1', redemption: 'redemption:1', refund: 'refund:1', ruleVersion: 1, amountMinor: 200, currency: 'USD', scope: 'mall:1', store, order, channel, scopes, timezone: 'America/New_York' },
    };
    const completed = await new ProjectEvent(repository).execute(event);
    expect(completed.map((item) => item.scope).sort()).toEqual([...scopes].sort());
    expect(repository.projected).toHaveLength(scopes.length * 2);
    expect(repository.projected.filter((metric) => metric.code === 'voucher.refund.amount')).toHaveLength(scopes.length);
    expect(repository.projected.filter((metric) => metric.code === 'voucher.refund.amount').every((metric) => metric.value === 200)).toBe(true);
    expect(repository.projected.filter((metric) => metric.code === 'voucher.refunds').every((metric) => metric.value === 1)).toBe(true);
    expect(repository.projected.every((metric) => metric.dimensions.currency === 'USD' && metric.period.timezone === 'America/New_York')).toBe(true);
    expect(repository.projected.some((metric) => metric.code === 'voucher.amount' || metric.code === 'voucher.redemptions')).toBe(false);
  });

  it.each([
    ['order', null, 'order:one', ['mall:1', 'group:1']],
    ['store', 'store:1', null, ['mall:1', 'group:1', 'store:1']],
    ['manual', null, null, ['mall:1', 'group:1']],
  ] as const)('projects %s voucher redemption without inventing a store or querying a transaction table', async (channel, store, order, scopes) => {
    const repository = new MemoryReporting();
    const event: ProjectionEvent = {
      id: 'event:voucher',
      type: 'voucher.redeemed',
      version: 2,
      aggregate: 'voucher:1',
      scope: 'mall:1',
      occurredAt: '2026-09-05T10:00:00Z',
      payload: { voucher: 'voucher:1', redemption: 'redemption:1', amountMinor: 600, currency: 'CNY', scope: 'mall:1', store, order, channel, scopes, timezone: 'Asia/Shanghai' },
    };
    const completed = await new ProjectEvent(repository).execute(event);
    expect(completed.map((item) => item.scope).sort()).toEqual([...scopes].sort());
    expect(repository.projected).toHaveLength(scopes.length * 2);
    expect(repository.projected.filter((metric) => metric.code === 'voucher.amount').every((metric) => metric.value === 600)).toBe(true);
    expect(repository.projected.every((metric) => metric.dimensions.channel === channel && metric.dimensions.store === (store ?? undefined))).toBe(true);
    await expect(new ProjectEvent(repository).execute({ ...event, version: 1 })).rejects.toThrow('REPORT_EVENT_VERSION_UNSUPPORTED');
  });

  it('projects one paid event across the frozen hierarchy and line partner without transaction joins', async () => {
    const repository = new MemoryReporting();
    const event: ProjectionEvent = {
      id: 'event:paid',
      type: 'order.paid',
      version: 1,
      aggregate: 'order:1',
      scope: 'mall:1',
      occurredAt: '2026-08-21T10:00:00Z',
      payload: {
        order: 'order:1',
        member: 'member:1',
        amountMinor: 900,
        currency: 'CNY',
        snapshot: {
          mall: 'mall:1',
          application: 'application:1',
          scopes: ['group:1', 'mall:1'],
          timezone: 'Asia/Shanghai',
          lines: [{ product: 'product:1', category: 'category:1', provider: 'provider:1', partner: 'partner:1', payableMinor: 900 }],
        },
      },
    };
    await new ProjectEvent(repository).execute(event);
    expect(repository.projected).toHaveLength(19);
    expect(repository.projected.filter(({ code }) => code === 'category.amount')).toHaveLength(3);
    expect(repository.projected.filter(({ code }) => code === 'member.amount')).toHaveLength(2);
    expect(repository.projected.filter(({ code }) => code === 'member.orders')).toHaveLength(2);
    expect(repository.projected.filter(({ code }) => code.startsWith('member.')).every(({ dimensions }) => dimensions.member === 'member:1')).toBe(true);
    expect(repository.projected.some(({ scope }) => scope === 'partner:1')).toBe(true);
    expect(repository.paid).toEqual({ order: 'order:1', amount: 900 });
    expect(repository.completed).toEqual([event]);
  });

  it('fails closed when a projection-routed event has no explicit mapping', async () => {
    const repository = new MemoryReporting();
    await expect(new ProjectEvent(repository).execute({ id: 'event:x', type: 'unknown.changed', version: 1, aggregate: 'x', scope: 'mall:1', occurredAt: '2026-08-21T10:00:00Z', payload: {} })).rejects.toThrow(
      'REPORT_EVENT_MAPPING_MISSING'
    );
    expect(repository.completed).toHaveLength(0);
  });

  it.each(['identity.session.revoked', 'identity.invitation.issued', 'identity.invitation.revoked', 'catalog.listing.unpublished'])('acknowledges the declared snapshot-only projection event %s', async (type) => {
    const repository = new MemoryReporting();
    const event: ProjectionEvent = { id: `event:${type}`, type, version: 1, aggregate: 'identity:1', scope: 'mall:1', occurredAt: '2026-08-21T10:00:00Z', payload: {} };

    await expect(new ProjectEvent(repository).execute(event)).resolves.toEqual([{ scope: 'mall:1', version: 1 }]);
    expect(repository.completed).toEqual([event]);
  });
});
