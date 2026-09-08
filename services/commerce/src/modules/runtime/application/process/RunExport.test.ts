import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { ObjectStore } from '../../public/ObjectPort';
import type { ExportPlan, ExportRenderer } from '../../public/ExportProcess';
import { RunExport } from './RunExport';

describe('runtime export kernel', () => {
  it('owns secure CSV rendering, bounded paging, progress and integrity verification', async () => {
    const output = writer();
    const complete = vi.fn();
    const advance = vi.fn();
    const renderer = strategy({
      advance,
      complete,
      read: vi.fn(async (_plan, cursor) =>
        cursor === null
          ? [
              { cursor: 'one', cells: ['=2+3'] },
              { cursor: 'two', cells: ['value,with delimiter'] },
            ]
          : []
      ),
    });

    await new RunExport('export', output.objects).execute('export:one', job(1), signal(), Date.now() + 10_000, renderer);

    expect(output.csv()).toBe('"value"\r\n"\'=2+3"\r\n"value,with delimiter"\r\n');
    expect(advance).toHaveBeenCalledWith(expect.anything(), 'two', 2);
    expect(complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ rows: 2 }));
    expect(output.objects.create).toHaveBeenCalledWith(expect.stringMatching(/^tenant\/[a-f0-9]{64}\/confidential\/reporting\/[a-f0-9]{32}\.csv$/), 'text/csv');
  });

  it('aborts and records a retryable failure when a frozen row count changes', async () => {
    const output = writer();
    const fail = vi.fn();
    const renderer = strategy({
      prepare: vi.fn(async () => 2),
      read: vi.fn(async (_plan, cursor) => (cursor === null ? [{ cursor: 'one', cells: ['only one'] }] : [])),
      fail,
    });

    await expect(new RunExport('export', output.objects).execute('export:one', job(1), signal(), Date.now() + 10_000, renderer)).rejects.toThrow('EXPORT_ROW_COUNT_MISMATCH');
    expect(output.abort).toHaveBeenCalledOnce();
    expect(fail).toHaveBeenCalledWith(expect.anything(), 'EXPORT_FAILED', false);
  });

  it('rejects repeated cursors and makes a non-retryable renderer failure terminal', async () => {
    const output = writer();
    const fail = vi.fn();
    const renderer = strategy({
      read: vi.fn(async (_plan, cursor) =>
        cursor === null
          ? [
              { cursor: 'one', cells: ['first'] },
              { cursor: 'two', cells: ['second'] },
            ]
          : [{ cursor: 'one', cells: ['repeated'] }]
      ),
      fail,
      retryable: vi.fn(() => false),
    });

    await expect(new RunExport('export', output.objects).execute('export:one', job(1), signal(), Date.now() + 10_000, renderer)).rejects.toThrow('EXPORT_PAGE_INVALID');
    expect(fail).toHaveBeenCalledWith(expect.anything(), 'EXPORT_FAILED', true);
  });
});

function strategy(overrides: Partial<ExportRenderer<ExportPlan>> = {}): ExportRenderer<ExportPlan> {
  const plan: ExportPlan = { id: 'export:one', owner: 'reporting', columns: ['value'], cursor: null, pageRows: 2, expectedRows: null, maximumAttempts: 3 };
  return {
    open: vi.fn(async () => plan),
    prepare: vi.fn(async () => 2),
    read: vi.fn(async () => []),
    advance: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    retryable: vi.fn(() => true),
    ...overrides,
  };
}

function job(attempts: number) {
  return { id: 'job:export:one', kind: 'export', scope: 'mall:one', payload: { export: 'export:one' }, authorization: {}, attempts, token: 1 } as const;
}
function signal(): AbortSignal {
  return new AbortController().signal;
}
function writer() {
  let content = '';
  let path = '';
  const abort = vi.fn(async () => undefined);
  const metadata = () => ({
    reference: 'object:one',
    path,
    contentType: 'text/csv',
    scan: 'clean' as const,
    sha256: createHash('sha256').update(content).digest('hex'),
    size: Buffer.byteLength(content),
    retentionUntil: null,
    lockedUntil: null,
  });
  const objects = {
    create: vi.fn(async (destination: string) => {
      path = destination;
      return {
        append: async (bytes: Uint8Array) => {
          content += new TextDecoder().decode(bytes);
        },
        complete: async () => metadata(),
        abort,
      };
    }),
    inspect: vi.fn(async () => metadata()),
    remove: vi.fn(async () => undefined),
  } as unknown as ObjectStore;
  return { objects, abort, csv: () => content };
}
