import { describe, expect, it, vi } from 'vitest';
import { ExportReport } from '../application/process/ExportReport';
import { ExportsReadHandler } from '../application/handler/ExportsReadHandler';
import { ExportsCreateHandler } from '../application/handler/ExportsCreateHandler';
import { exportFilter, metricExportQuery } from '../domain/value/ExportFilter';

const watermark = { event: 'event:watermark', occurredAt: '2026-09-03T00:00:00.000Z', version: 9 } as const;
const filter = { view: 'sales', period: '30days' } as const;
const reportSnapshot = {
  query: { scope: 'enterprise:one', dimension: 'sales', period: '30days', application: null },
  watermark,
  generatedAt: '2026-09-03T00:00:01.000Z',
  generationVersion: 1,
} as const;

describe('secure report export', () => {
  it('creates the frozen report snapshot and Runtime job in the authorized scope', async () => {
    const created = exportJob('queued');
    const reports = { watermark: vi.fn(async () => watermark), createExport: vi.fn(async () => created) };
    const jobs = { create: vi.fn(async () => undefined) };
    const handler = new ExportsCreateHandler(reports as never, jobs as never);
    const response = await handler.execute({ body: { report: 'metrics', filter, snapshot: reportSnapshot } } as never, context() as never);

    expect(response).toEqual({ status: 202, body: created });
    expect(reports.createExport).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scope: 'enterprise:one',
        actor: 'actor:one',
        membership: 'membership:one',
        report: 'metrics',
        filter,
        snapshot: { filter, watermark, generatedAt: reportSnapshot.generatedAt, generationVersion: 1 },
      })
    );
    expect(jobs.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scope: 'enterprise:one',
        owner: 'reporting',
        kind: 'export',
        queue: 'export',
        idempotency: 'request:one',
        actor: 'actor:one',
        payload: { export: expect.stringMatching(/^export:/) },
      })
    );
  });

  it('rejects a client snapshot from another scope or beyond the current watermark before scheduling work', async () => {
    const reports = { watermark: vi.fn(async () => watermark), createExport: vi.fn() };
    const jobs = { create: vi.fn() };
    const handler = new ExportsCreateHandler(reports as never, jobs as never);

    await expect(handler.execute({ body: { report: 'metrics', filter, snapshot: { ...reportSnapshot, query: { ...reportSnapshot.query, scope: 'enterprise:other' } } } } as never, context() as never)).rejects.toThrow(
      'REPORT_SNAPSHOT_INVALID'
    );
    await expect(handler.execute({ body: { report: 'metrics', filter, snapshot: { ...reportSnapshot, watermark: { ...watermark, version: 10 } } } } as never, context() as never)).rejects.toThrow('REPORT_EXPORT_SNAPSHOT_INVALID');
    expect(reports.createExport).not.toHaveBeenCalled();
    expect(jobs.create).not.toHaveBeenCalled();
  });

  it('derives interactive and export dimensions from one strict filter policy', () => {
    const selected = exportFilter('metrics', { view: 'members', period: '7days', application: 'application:one' });
    expect(selected).toEqual({ view: 'members', period: '7days', application: 'application:one' });
    expect(metricExportQuery('enterprise:one', selected)).toEqual({ scope: 'enterprise:one', dimension: 'member', period: '7days', application: 'application:one' });
    expect(() => exportFilter('metrics', { view: 'sales', period: '30days', metric: 'product' })).toThrow('REPORT_FILTER_INVALID');
  });

  it('authorizes only a five minute download after a clean completed object', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://objects.example/report.csv?token=one', expiresAt: '2026-09-03T00:05:00.000Z' });
    const handler = new ExportsReadHandler({} as never, { authorize } as never);
    const response = await handler.finalize(
      {} as never,
      {
        id: 'export:one',
        scope: 'enterprise:one',
        report: 'metrics',
        filter: {},
        snapshot: { filter: {}, watermark: { event: 'event:one', occurredAt: '2026-09-03T00:00:00.000Z', version: 1 }, generatedAt: '2026-09-03T00:00:00.000Z', generationVersion: 1 },
        state: 'completed',
        cursor: null,
        recordCount: 2,
        objectReference: 'reports/export/one.csv',
        objectHash: 'a'.repeat(64),
        objectSize: 120,
        scanState: 'clean',
        expiresAt: '2026-09-03T00:10:00.000Z',
        createdAt: '2026-09-03T00:00:00.000Z',
        generatedAt: '2026-09-03T00:01:00.000Z',
      },
      {} as never
    );
    expect(authorize).toHaveBeenCalledWith('reports/export/one.csv', 300);
    expect(response.body.download?.url).toContain('https://objects.example/');
  });

  it('keeps the execution type constructible with bounded dependencies', () => {
    expect(new ExportReport({} as never, {} as never, {} as never, 3)).toBeTruthy();
  });

  it('exports the same named dimensions as the page with beginner-friendly Chinese columns', async () => {
    const metric = {
      code: 'sales.amount',
      version: 2,
      definition: { name: '成交金额', formula: '支付金额合计', dimensions: ['mall', 'application'], granularity: 'day' as const, owner: 'reporting' as const },
      scope: 'enterprise:one',
      period: { from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z', timezone: 'Asia/Shanghai' },
      dimensions: { mall: 'mall:one', application: 'application:one' },
      value: 12345,
      unit: 'minor' as const,
      currency: 'CNY',
      watermark: '2026-09-02T01:02:03.000Z',
      projectionVersion: 7,
      cursorTime: '2026-09-02T00:00:00.000Z',
      cursorId: 'cursor:one',
    };
    const repository = {
      claimExport: vi.fn(async () => exportJob('queued')),
      metricExportRows: vi.fn(async () => [{ key: 'cursor:one', metric, generatedAt: '2026-09-03T00:00:00.000Z' }]),
    };
    const dimensions = {
      present: vi.fn(async (_context: unknown, _scope: string, rows: readonly (typeof metric)[]) =>
        rows.map((row) => ({
          ...row,
          displayedDimensions: [
            { code: 'mall', name: '商城', value: '总部福利商城' },
            { code: 'application', name: '商城应用', value: '员工商城' },
          ],
        }))
      ),
    };
    const renderer = new ExportReport(transactions() as never, repository as never, dimensions as never, 3);
    const plan = await renderer.open('export:one', execution());

    expect(plan?.columns).toEqual(['指标', '统计维度', '指标值', '单位', '币种', '统计开始', '统计结束', '时区', '数据截至', '指标版本', '投影版本', '计算口径', '数据粒度', '报表生成时间']);
    const page = await renderer.read(plan!, null, 1000);
    expect(page[0]?.cells).toEqual([
      '成交金额',
      '商城：总部福利商城；商城应用：员工商城',
      '123.45',
      '元',
      '人民币（CNY）',
      '2026-09-01 08:00:00',
      '2026-09-02 08:00:00',
      '中国标准时间（Asia/Shanghai）',
      '2026-09-02 09:02:03',
      'v2',
      'v7',
      '支付金额合计',
      '按日',
      '2026-09-03 08:00:00',
    ]);
    expect(JSON.stringify(page)).not.toMatch(/(?:enterprise|mall|application):one/u);
    expect(dimensions.present).toHaveBeenCalledWith(expect.anything(), 'enterprise:one', [metric]);
  });

  it('walks a large frozen result through bounded keyset pages without gaps or duplicates', async () => {
    const rows = Array.from({ length: 2501 }, (_, index) => ({ key: String(index + 1).padStart(6, '0'), values: [index + 1] }));
    const advanced: string[] = [];
    const repository = {
      claimExport: vi.fn(async () => ({ ...exportJob('queued', 'orders'), filter, snapshot: { ...exportJob('queued', 'orders').snapshot, filter } })),
      exportCount: vi.fn(async () => rows.length),
      exportRows: vi.fn(async (_context: unknown, _id: string, _report: string, cursor: string | null, fetch: number) => {
        const offset = cursor === null ? 0 : rows.findIndex((row) => row.key === cursor) + 1;
        return rows.slice(offset, offset + fetch);
      }),
      advanceExport: vi.fn(async (_context: unknown, _id: string, cursor: string) => {
        advanced.push(cursor);
      }),
    };
    const renderer = new ExportReport(transactions() as never, repository as never, {} as never, 3);
    const plan = await renderer.open('export:one', execution());
    expect(plan).not.toBeNull();
    expect(await renderer.prepare(plan!)).toBe(2501);

    const visited: string[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page = await renderer.read(plan!, cursor, plan!.pageRows);
      if (page.length === 0) break;
      visited.push(...page.map((row) => row.cursor));
      cursor = page.at(-1)!.cursor;
      await renderer.advance(plan!, cursor, page.length);
    }
    expect(visited).toHaveLength(2501);
    expect(new Set(visited).size).toBe(2501);
    expect(advanced).toEqual(['001000', '002000', '002501']);
    expect(repository.exportRows).toHaveBeenCalledTimes(4);
  });
});

function exportJob(state: 'queued' | 'completed', report: 'metrics' | 'orders' = 'metrics') {
  return {
    id: 'export:one',
    scope: 'enterprise:one',
    report,
    filter: {},
    snapshot: { filter: {}, watermark: { event: 'event:one', occurredAt: '2026-09-03T00:00:00.000Z', version: 1 }, generatedAt: '2026-09-03T00:00:00.000Z', generationVersion: 1 },
    state,
    cursor: null,
    recordCount: state === 'completed' ? 2 : 0,
    objectReference: state === 'completed' ? 'reports/export/one.csv' : null,
    objectHash: state === 'completed' ? 'a'.repeat(64) : null,
    objectSize: state === 'completed' ? 120 : null,
    scanState: state === 'completed' ? ('clean' as const) : null,
    expiresAt: state === 'completed' ? '2026-09-03T00:10:00.000Z' : null,
    createdAt: '2026-09-03T00:00:00.000Z',
    generatedAt: state === 'completed' ? '2026-09-03T00:01:00.000Z' : null,
  };
}

function transactions() {
  return {
    read: async (_options: unknown, work: (context: unknown) => Promise<unknown>) => work({}),
    write: async (_options: unknown, work: (context: unknown) => Promise<unknown>) => work({}),
  };
}

function execution() {
  return { scope: 'enterprise:one', trace: 'job:one', attempts: 1, signal: new AbortController().signal, deadline: Date.now() + 10_000 };
}

function context() {
  return {
    operation: 'reporting.exports.create',
    traceId: 'trace:one',
    requestId: 'request:one',
    idempotencyKey: 'request:one',
    transaction: {},
    security: { kind: 'session', access: { actor: { id: 'actor:one' }, membership: { id: 'membership:one' }, scope: { id: 'enterprise:one' } } },
  };
}
