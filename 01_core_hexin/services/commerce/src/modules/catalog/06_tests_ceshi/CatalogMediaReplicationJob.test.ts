import { describe, expect, it, vi } from 'vitest';
import type { ClaimedJob } from '../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { CatalogProductMediaRegistration } from '../03_application_yingyong/CatalogProductMediaRegistration';
import { CatalogMediaReplicationProcessor } from '../05_interface_jieru/job/CatalogMediaReplicationJob';

describe('CatalogMediaReplicationProcessor', () => {
  it('uses the first available source and publishes the verified primary replica URL', async () => {
    const queries: { text: string; values?: readonly unknown[] }[] = [];
    const pool = poolWithQueries(queries, 1);
    const register = vi.fn(async () => registrationResult());
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png; charset=binary' } }));
    const processor = new CatalogMediaReplicationProcessor(
      pool,
      { register } as Pick<CatalogProductMediaRegistration, 'register'>,
      'zhudatuan',
      fetcher as typeof fetch,
    );

    await processor.process(job(), new AbortController().signal);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledWith(pool, expect.objectContaining({
      productId: 'product:one', contentType: 'image/png', purpose: 'cover', position: 0,
    }));
    expect(queries[0]?.values).toEqual(['product:one', 'https://media.zhudatuan.com/catalog-media/cover.png']);
  });

  it('fails without persisting when every supplier source is unavailable', async () => {
    const queries: { text: string; values?: readonly unknown[] }[] = [];
    const register = vi.fn();
    const processor = new CatalogMediaReplicationProcessor(
      poolWithQueries(queries, 1),
      { register } as Pick<CatalogProductMediaRegistration, 'register'>,
      'zhudatuan',
      vi.fn().mockResolvedValue(new Response('', { status: 404 })) as unknown as typeof fetch,
    );

    await expect(processor.process(job(), new AbortController().signal))
      .rejects.toThrow('CATALOG_MEDIA_SOURCE_UNAVAILABLE');
    expect(register).not.toHaveBeenCalled();
    expect(queries).toHaveLength(0);
  });

  it('does not publish a URL when required replication is incomplete', async () => {
    const queries: { text: string; values?: readonly unknown[] }[] = [];
    const processor = new CatalogMediaReplicationProcessor(
      poolWithQueries(queries, 1),
      { register: vi.fn(async () => registrationResult('incomplete')) } as Pick<CatalogProductMediaRegistration, 'register'>,
      'zhudatuan',
      vi.fn().mockResolvedValue(new Response(new Uint8Array([1]))) as unknown as typeof fetch,
    );

    await expect(processor.process(job(), new AbortController().signal))
      .rejects.toThrow('CATALOG_MEDIA_REPLICATION_INCOMPLETE');
    expect(queries).toHaveLength(0);
  });

  it('rejects malformed task payloads', async () => {
    const processor = new CatalogMediaReplicationProcessor(
      poolWithQueries([], 1),
      { register: vi.fn() } as Pick<CatalogProductMediaRegistration, 'register'>,
      'zhudatuan',
    );
    await expect(processor.process({ ...job(), payload: { productId: 'product:one' } }, new AbortController().signal))
      .rejects.toThrow('CATALOG_MEDIA_JOB_PAYLOAD_INVALID');
  });
});

function job(): ClaimedJob {
  return {
    id: 'job:media:one', kind: 'catalogmediareplication', scope_id: 'mall:one', attempts: 1,
    payload: {
      productId: 'product:one',
      sourceUrls: ['https://supplier.invalid/missing.png', 'https://supplier.example/cover.png'],
      purpose: 'cover',
      position: 0,
    },
  };
}

function poolWithQueries(calls: { text: string; values?: readonly unknown[] }[], rowCount: number): DatabasePool {
  return {
    query: async (text: string, values?: readonly unknown[]) => {
      calls.push(values === undefined ? { text } : { text, values });
      return { rows: [], rowCount, command: '', oid: 0, fields: [] };
    },
  } as unknown as DatabasePool;
}

function registrationResult(status: 'complete' | 'incomplete' = 'complete') {
  return Object.freeze({
    mediaId: 'media:one', objectKey: 'catalog-media/cover.png', sha256: 'a'.repeat(64),
    contentType: 'image/png', byteSize: 3, overallStatus: status,
    replicas: Object.freeze([Object.freeze({
      targetId: 'zhudatuan', provider: 'aliyun-oss', bucket: 'zhudatuan',
      publicUrl: 'https://media.zhudatuan.com/catalog-media/cover.png', required: true,
      uploadStatus: status === 'complete' ? 'uploaded' as const : 'failed' as const,
      verificationStatus: status === 'complete' ? 'verified' as const : 'failed' as const,
      error: status === 'complete' ? null : 'upload failed',
    })]),
    productId: 'product:one', purpose: 'cover' as const, position: 0,
    bindingStatus: status === 'complete' ? 'ready' as const : 'not_ready' as const,
  });
}
