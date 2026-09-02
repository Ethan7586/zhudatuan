import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { BatchImportProcessPort, ImportTarget } from '../../src/foundation/application/BatchImport';
import { ProcessBatchImport } from '../../src/foundation/application/process/ProcessBatchImport';
import type { ObjectStore, ObjectUpload, StoredObject } from '../../src/foundation/infrastructure/ObjectStore';

describe('batch import lifecycle', () => {
  it('validates, stages, processes and publishes a formula-safe row report', async () => {
    const source = new TextEncoder().encode('title,sku,category\nProduct,SKU-1,CATEGORY-1\n');
    const objects = objectStore(source);
    const port = importPort();
    const process = new ProcessBatchImport('catalog', objects.store, port.value);
    await process.execute('catalogimport:00000000-0000-4000-8000-000000000001', 'supplier:test', new AbortController().signal, Date.now() + 30_000);
    expect(port.stage).toHaveBeenCalledWith(expect.objectContaining({ scope: 'supplier:test' }), [{ title: 'Product', sku: 'SKU-1', category: 'CATEGORY-1' }], expect.objectContaining({ scope: 'supplier:test' }));
    expect(port.process).toHaveBeenCalledOnce();
    expect(port.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scan: 'clean' }), expect.objectContaining({ scope: 'supplier:test' }));
    expect(new TextDecoder().decode(objects.report())).toContain("'=HYPERLINK");
  });

  it('records a permanent integrity rejection without applying a row', async () => {
    const source = new TextEncoder().encode('sku,location,onhand\nSKU-1,MAIN,10\n');
    const objects = objectStore(source);
    const port = importPort({ ...target('inventoryimport'), sha256: '0'.repeat(64) });
    const process = new ProcessBatchImport('inventory', objects.store, port.value);
    await process.execute('inventoryimport:00000000-0000-4000-8000-000000000001', 'supplier:test', new AbortController().signal, Date.now() + 30_000);
    expect(port.reject).toHaveBeenCalledWith(expect.anything(), 'IMPORT_OBJECT_INVALID', 'IMPORT_OBJECT_INVALID', expect.objectContaining({ scope: 'supplier:test' }));
    expect(port.stage).not.toHaveBeenCalled();
    expect(port.complete).not.toHaveBeenCalled();
  });

  it.each([
    ['memberimport', 'member', 'displayName,employeeNo\nA,E-1\n'],
    ['voucherimport', 'voucher', 'code\nCARD-0001\n'],
  ] as const)('uses the resumable lifecycle for %s without a synchronous import path', async (kind, owner, csv) => {
    const source = new TextEncoder().encode(csv);
    const objects = objectStore(source);
    const port = importPort(target(kind, source));
    await new ProcessBatchImport(owner, objects.store, port.value).execute(`${kind}:00000000-0000-4000-8000-000000000001`, 'supplier:test', new AbortController().signal, Date.now() + 30_000);
    expect(port.stage).toHaveBeenCalledOnce();
    expect(port.process).toHaveBeenCalledOnce();
    expect(port.complete).toHaveBeenCalledOnce();
  });
});

function importPort(candidate = target('catalogimport')) {
  const stage = vi.fn(async () => undefined);
  const process = vi.fn(async () => true);
  const complete = vi.fn(async () => undefined);
  const reject = vi.fn(async () => undefined);
  const value: BatchImportProcessPort = {
    find: async () => candidate,
    stage,
    process,
    failures: async () => [{ row: 2, reason: 'ROW_INVALID', field: 'title', detail: '=HYPERLINK("unsafe")' }],
    complete,
    reject,
    fault: vi.fn(async () => undefined),
  };
  return { value, stage, process, complete, reject };
}

type ImportKind = 'catalogimport' | 'inventoryimport' | 'memberimport' | 'voucherimport';

function target(kind: ImportKind, source?: Uint8Array): ImportTarget {
  const bytes = source ?? (kind === 'catalogimport' ? new TextEncoder().encode('title,sku,category\nProduct,SKU-1,CATEGORY-1\n') : new TextEncoder().encode('sku,location,onhand\nSKU-1,MAIN,10\n'));
  return { id: `${kind}:00000000-0000-4000-8000-000000000001`, scope: 'supplier:test', reference: 'object:source', sha256: createHash('sha256').update(bytes).digest('hex'), state: 'uploaded' };
}

function objectStore(source: Uint8Array) {
  let report = new Uint8Array();
  const sha256 = createHash('sha256').update(source).digest('hex');
  const store: ObjectStore = {
    inspect: async () => ({ reference: 'object:source', sha256, size: source.byteLength, scan: 'clean', contentType: 'text/csv', path: 'imports/source.csv' }),
    read: async () => source,
    find: async () => null,
    create: async () => {
      const chunks: Uint8Array[] = [];
      const upload: ObjectUpload = {
        append: async (bytes) => {
          chunks.push(bytes);
        },
        abort: async () => undefined,
        complete: async (): Promise<StoredObject> => {
          const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
          report = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            report.set(chunk, offset);
            offset += chunk.byteLength;
          }
          return { reference: 'object:report', sha256: createHash('sha256').update(report).digest('hex'), size, scan: 'clean' };
        },
      };
      return upload;
    },
    authorize: async () => ({ url: 'https://objects.invalid/report', expiresAt: '2099-01-01T00:00:00.000Z' }),
    authorizeUpload: async () => {
      throw new Error('NOT_SUPPORTED');
    },
  };
  return { store, report: () => report };
}
