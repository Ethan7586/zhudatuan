import { describe, expect, it } from 'vitest';
import type { ReportingPort } from '../../01_public_gongkai/ReportingPort';
import type { ExportJob, ExportReport, ExportRow } from '../../02_domain_yewu/model/ExportJob';
import type { CockpitSummary, Metric, MetricQuery, MetricRow } from '../../02_domain_yewu/model/Metric';
import type { OrderProjection, ProjectionEvent } from '../../02_domain_yewu/model/Projection';
import { ProjectEvent } from '../../03_application_yingyong/command/ProjectEvent';

class MemoryReporting implements ReportingPort {
  readonly projected: Metric[] = [];
  readonly completed: ProjectionEvent[] = [];
  paid: Readonly<{ order: string; amount: number }> | null = null;

  metrics(_query: MetricQuery): Promise<readonly MetricRow[]> { return Promise.resolve([]); }
  dashboard(): Promise<Readonly<{ rows: readonly MetricRow[]; summary: CockpitSummary }>> { return Promise.reject(new Error('UNUSED')); }
  exports(): Promise<readonly ExportJob[]> { return Promise.resolve([]); }
  export(_id: string, _scope: string): Promise<ExportJob | null> { return Promise.resolve(null); }
  createExport(): Promise<ExportJob> { return Promise.reject(new Error('UNUSED')); }
  claimEvent(): Promise<ProjectionEvent | null> { return Promise.resolve(null); }
  period(_occurredAt: string, timezone: string) { return Promise.resolve({ from: '2026-08-21T00:00:00Z', to: '2026-08-22T00:00:00Z', timezone }); }
  addMetrics(metrics: readonly Metric[]): Promise<void> { this.projected.push(...metrics); return Promise.resolve(); }
  createOrder(_projection: OrderProjection): Promise<void> { return Promise.resolve(); }
  payOrder(order: string, amountMinor: number): Promise<void> { this.paid = { order, amount: amountMinor }; return Promise.resolve(); }
  cancelOrder(): Promise<void> { return Promise.resolve(); }
  shipOrder(): Promise<void> { return Promise.resolve(); }
  saveStatement(): Promise<void> { return Promise.resolve(); }
  completeEvent(event: ProjectionEvent, scopes: readonly string[]) { this.completed.push(event); return Promise.resolve(scopes.map((scope) => ({ scope, version: 1 }))); }
  claimExport(): Promise<ExportJob | null> { return Promise.resolve(null); }
  exportRows(_id: string, _report: ExportReport, _filter: Readonly<Record<string, unknown>>, _cursor: string | null, _fetch: number): Promise<readonly ExportRow[]> { return Promise.resolve([]); }
  advanceExport(): Promise<void> { return Promise.resolve(); }
  completeExport(): Promise<void> { return Promise.resolve(); }
  failExport(): Promise<void> { return Promise.resolve(); }
}

describe('reporting event projection', () => {
  it('projects one paid event across the frozen hierarchy and line partner without transaction joins', async () => {
    const repository = new MemoryReporting();
    const event: ProjectionEvent = { id: 'event:paid', type: 'order.paid', version: 1, aggregate: 'order:1', scope: 'mall:1',
      occurredAt: '2026-08-21T10:00:00Z', payload: { order: 'order:1', amountMinor: 900, currency: 'CNY', snapshot: {
        mall: 'mall:1', application: 'application:1', scopes: ['group:1','mall:1'], timezone: 'Asia/Shanghai',
        lines: [{ product: 'product:1', category: 'category:1', powderclass: 'category:1', provider: 'provider:1', partner: 'partner:1', payableMinor: 900 }],
      } } };
    await new ProjectEvent(repository).execute(event);
    expect(repository.projected).toHaveLength(18);
    expect(repository.projected.filter(({ code }) => code === 'powderclass.amount')).toHaveLength(3);
    expect(repository.projected.some(({ scope }) => scope === 'partner:1')).toBe(true);
    expect(repository.projected.filter(({ scope }) => scope === 'partner:1').every(({ dimensions }) => dimensions.supplier === 'partner:1')).toBe(true);
    expect(repository.paid).toEqual({ order: 'order:1', amount: 900 });
    expect(repository.completed).toEqual([event]);
  });

  it('fails closed when a projection-routed event has no explicit mapping', async () => {
    const repository = new MemoryReporting();
    await expect(new ProjectEvent(repository).execute({ id: 'event:x', type: 'unknown.changed', version: 1, aggregate: 'x', scope: 'mall:1',
      occurredAt: '2026-08-21T10:00:00Z', payload: {} })).rejects.toThrow('REPORT_EVENT_MAPPING_MISSING');
    expect(repository.completed).toHaveLength(0);
  });
});
