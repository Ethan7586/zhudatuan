import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CatalogMediaReplication } from '../03_application_yingyong/CatalogMediaReplication';
import type {
  CatalogMediaObjectStorage,
  CatalogMediaObjectUpload,
  CatalogMediaStoredObject,
  CatalogMediaTarget,
} from '../03_application_yingyong/port/CatalogMediaObjectStorage';
import { catalogMediaTargets } from '../04_adapters_shixian/config/CatalogMediaTargets';

const bytes = new TextEncoder().encode('same-product-media');

describe('CatalogMediaReplication', () => {
  it('derives the same object key and SHA-256 from the same input', async () => {
    const stores = storesFor(targets());
    const coordinator = replication(targets(), stores);

    const first = await coordinator.replicate(input());
    const second = await coordinator.replicate(input());

    expect(second.objectKey).toBe(first.objectKey);
    expect(second.sha256).toBe(first.sha256);
    expect(first.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  });

  it('is complete when every required target uploads and verifies', async () => {
    const configured = targets();
    const result = await replication(configured, storesFor(configured)).replicate(input());

    expect(result.overallStatus).toBe('complete');
    expect(result.replicas).toHaveLength(2);
    expect(result.replicas.every(({ verificationStatus }) => verificationStatus === 'verified')).toBe(true);
  });

  it('is incomplete when any required target fails', async () => {
    const configured = targets();
    const stores = storesFor(configured);
    stores.get('fufu')!.uploadError = new Error('OSS_UPLOAD_FAILED');

    const result = await replication(configured, stores).replicate(input());

    expect(result.overallStatus).toBe('incomplete');
    expect(result.replicas.find(({ targetId }) => targetId === 'fufu')).toMatchObject({
      uploadStatus: 'failed', verificationStatus: 'failed', error: 'OSS_UPLOAD_FAILED',
    });
  });

  it('keeps target failures independent when an adapter cannot be resolved', async () => {
    const configured = targets();
    const stores = storesFor(configured);
    const coordinator = new CatalogMediaReplication(configured, ({ id }) => {
      if (id === 'fufu') throw new Error('OSS_ADAPTER_UNAVAILABLE');
      return stores.get(id)!;
    });

    const result = await coordinator.replicate(input());

    expect(result.replicas.find(({ targetId }) => targetId === 'zhudatuan')?.verificationStatus).toBe('verified');
    expect(result.replicas.find(({ targetId }) => targetId === 'fufu')).toMatchObject({
      uploadStatus: 'failed', verificationStatus: 'failed', error: 'OSS_ADAPTER_UNAVAILABLE',
    });
  });

  it('handles three or more enabled targets without changing coordination code', async () => {
    const configured = [...targets(), mediaTarget('third', true, 'https://media.third.example')];
    const result = await replication(configured, storesFor(configured)).replicate(input());

    expect(result.overallStatus).toBe('complete');
    expect(result.replicas.map(({ targetId }) => targetId)).toEqual(['zhudatuan', 'fufu', 'third']);
  });

  it('preserves an optional target failure without changing required completion', async () => {
    const configured = [...targets(), mediaTarget('optional', false, 'https://media.optional.example')];
    const stores = storesFor(configured);
    stores.get('optional')!.uploadError = new Error('OPTIONAL_UPLOAD_FAILED');

    const result = await replication(configured, stores).replicate(input());

    expect(result.overallStatus).toBe('complete');
    expect(result.replicas.find(({ targetId }) => targetId === 'optional')).toMatchObject({
      required: false, uploadStatus: 'failed', verificationStatus: 'failed', error: 'OPTIONAL_UPLOAD_FAILED',
    });
  });

  it('marks a replica verification as failed when its stored hash differs', async () => {
    const configured = targets();
    const stores = storesFor(configured);
    stores.get('fufu')!.inspectedSha256 = 'not-the-uploaded-hash';

    const result = await replication(configured, stores).replicate(input());

    expect(result.overallStatus).toBe('incomplete');
    expect(result.replicas.find(({ targetId }) => targetId === 'fufu')).toMatchObject({
      uploadStatus: 'uploaded', verificationStatus: 'failed', error: 'CATALOG_MEDIA_SHA256_MISMATCH',
    });
  });

  it('keeps retries idempotent with one object key per target', async () => {
    const configured = targets();
    const stores = storesFor(configured);
    const coordinator = replication(configured, stores);

    const first = await coordinator.replicate(input());
    const retry = await coordinator.replicate(input());

    expect(retry.objectKey).toBe(first.objectKey);
    expect([...stores.values()].map(({ objects }) => objects.size)).toEqual([1, 1]);
  });

  it('builds each public URL from that target public base URL', async () => {
    const configured = targets();
    const result = await replication(configured, storesFor(configured)).replicate(input());

    expect(result.replicas[0]!.publicUrl).toBe(`https://media.zhudatuan.com/${result.objectKey}`);
    expect(result.replicas[1]!.publicUrl).toBe(`https://media.fufu.com/${result.objectKey}`);
  });

  it('configures the current peer targets for the two media domains', () => {
    expect(catalogMediaTargets({})).toEqual([
      expect.objectContaining({ id: 'zhudatuan', publicBaseUrl: 'https://media.zhudatuan.com', required: true, enabled: true }),
      expect.objectContaining({ id: 'fufu', publicBaseUrl: 'https://media.fufu.com', required: true, enabled: true }),
    ]);
  });

  it('does not carry a supplier source URL into its persisted result shape', async () => {
    const configured = targets();
    const runtimeInput = { ...input(), supplierSourceUrl: 'https://supplier.example/original.jpg' };
    const result = await replication(configured, storesFor(configured)).replicate(runtimeInput);

    expect(JSON.stringify(result)).not.toContain('supplier.example');
    expect(Object.keys(result)).toEqual(['mediaId', 'objectKey', 'sha256', 'contentType', 'byteSize', 'overallStatus', 'replicas']);
  });
});

function input() {
  return { productId: 'product:42', bytes, contentType: 'image/webp', purpose: 'cover' as const };
}

function targets(): readonly CatalogMediaTarget[] {
  return [
    mediaTarget('zhudatuan', true, 'https://media.zhudatuan.com'),
    mediaTarget('fufu', true, 'https://media.fufu.com'),
  ];
}

function mediaTarget(id: string, required: boolean, publicBaseUrl: string): CatalogMediaTarget {
  return { id, provider: 'aliyun-oss', endpoint: 'oss.example', region: 'cn-test', bucket: `${id}-media`, publicBaseUrl, required, enabled: true };
}

function storesFor(configured: readonly CatalogMediaTarget[]): Map<string, MemoryMediaStorage> {
  return new Map(configured.map(({ id }) => [id, new MemoryMediaStorage()]));
}

function replication(configured: readonly CatalogMediaTarget[], stores: ReadonlyMap<string, MemoryMediaStorage>) {
  return new CatalogMediaReplication(configured, ({ id }) => stores.get(id)!);
}

class MemoryMediaStorage implements CatalogMediaObjectStorage {
  readonly objects = new Map<string, CatalogMediaObjectUpload>();
  uploadError: Error | null = null;
  inspectedSha256: string | null = null;

  async upload(input: CatalogMediaObjectUpload): Promise<void> {
    if (this.uploadError) throw this.uploadError;
    this.objects.set(input.objectKey, input);
  }

  async inspect(objectKey: string): Promise<CatalogMediaStoredObject> {
    const object = this.objects.get(objectKey);
    return object
      ? { exists: true, byteSize: object.bytes.byteLength, sha256: this.inspectedSha256 ?? object.sha256 }
      : { exists: false, byteSize: 0, sha256: null };
  }
}
