import { describe, expect, it } from 'vitest';
import { CatalogMediaReplication } from '../03_application_yingyong/CatalogMediaReplication';
import type { CatalogMediaObjectUpload, CatalogMediaTarget } from '../03_application_yingyong/port/CatalogMediaObjectStorage';
import {
  AliyunOssCatalogMediaStorage,
  type AliyunOssClient,
  type AliyunOssHeadResult,
} from '../04_adapters_shixian/object_storage/AliyunOssCatalogMediaStorage';
import {
  createCatalogMediaStorageResolver,
  type AliyunOssClientConfiguration,
} from '../04_adapters_shixian/object_storage/CatalogMediaStorageResolver';

const bytes = new TextEncoder().encode('aliyun-oss-product-media');

describe('AliyunOssCatalogMediaStorage', () => {
  it('puts the exact object key, bytes, content type and SHA-256 metadata', async () => {
    const client = new FakeAliyunOssClient();
    const storage = new AliyunOssCatalogMediaStorage(client);
    const upload = mediaUpload();

    await storage.upload(upload);

    expect(client.puts).toHaveLength(1);
    expect(client.puts[0]).toMatchObject({
      objectKey: upload.objectKey,
      options: { mime: upload.contentType, meta: { sha256: upload.sha256 } },
    });
    expect(client.puts[0]!.bytes.equals(Buffer.from(upload.bytes))).toBe(true);
  });

  it('maps HeadObject content length and SHA-256 metadata', async () => {
    const client = new FakeAliyunOssClient();
    client.headResult = {
      meta: { sha256: 'stored-sha256' },
      res: { headers: { 'content-length': '321' } },
    };

    await expect(new AliyunOssCatalogMediaStorage(client).inspect('catalog-media/key')).resolves.toEqual({
      exists: true, byteSize: 321, sha256: 'stored-sha256',
    });
  });

  it.each([
    Object.assign(new Error('missing'), { code: 'NoSuchKey', status: 404 }),
    Object.assign(new Error('missing'), { status: 404 }),
    Object.assign(new Error('missing'), { statusCode: 404 }),
  ])('maps an object-not-found response to exists false', async (headError) => {
    const client = new FakeAliyunOssClient();
    client.headError = headError;

    await expect(new AliyunOssCatalogMediaStorage(client).inspect('missing')).resolves.toEqual({
      exists: false, byteSize: 0, sha256: null,
    });
  });

  it.each([
    Object.assign(new Error('AccessDenied'), { code: 'AccessDenied', status: 403 }),
    Object.assign(new Error('socket unavailable'), { code: 'ConnectionTimeoutError', status: -2 }),
    Object.assign(new Error('NoSuchBucket'), { code: 'NoSuchBucket', status: 404 }),
    Object.assign(new Error('service unavailable'), { status: 503 }),
  ])('does not swallow authentication, network or non-object service errors', async (headError) => {
    const client = new FakeAliyunOssClient();
    client.headError = headError;

    await expect(new AliyunOssCatalogMediaStorage(client).inspect('catalog-media/key')).rejects.toBe(headError);
  });

  it('creates peer target clients from separate target config and credentials', () => {
    const configurations: AliyunOssClientConfiguration[] = [];
    const resolver = createCatalogMediaStorageResolver({
      CATALOG_MEDIA_ZHUDATUAN_ACCESS_KEY_ID: 'zhudatuan-id',
      CATALOG_MEDIA_ZHUDATUAN_ACCESS_KEY_SECRET: 'zhudatuan-secret',
      CATALOG_MEDIA_FUFU_ACCESS_KEY_ID: 'fufu-id',
      CATALOG_MEDIA_FUFU_ACCESS_KEY_SECRET: 'fufu-secret',
    }, (configuration) => {
      configurations.push(configuration);
      return new FakeAliyunOssClient();
    });

    resolver(target('zhudatuan', 'zhudatuan-bucket', 'oss-cn-a.example'));
    resolver(target('fufu', 'fufu-bucket', 'oss-cn-b.example'));

    expect(configurations).toEqual([
      expect.objectContaining({ bucket: 'zhudatuan-bucket', endpoint: 'oss-cn-a.example', accessKeyId: 'zhudatuan-id', accessKeySecret: 'zhudatuan-secret' }),
      expect.objectContaining({ bucket: 'fufu-bucket', endpoint: 'oss-cn-b.example', accessKeyId: 'fufu-id', accessKeySecret: 'fufu-secret' }),
    ]);
  });

  it('accepts a third target through configuration alone', () => {
    const configurations: AliyunOssClientConfiguration[] = [];
    const resolver = createCatalogMediaStorageResolver({
      CATALOG_MEDIA_THIRD_SHOP_ACCESS_KEY_ID: 'third-id',
      CATALOG_MEDIA_THIRD_SHOP_ACCESS_KEY_SECRET: 'third-secret',
    }, (configuration) => {
      configurations.push(configuration);
      return new FakeAliyunOssClient();
    });

    resolver(target('third-shop', 'third-bucket', 'oss-cn-third.example'));

    expect(configurations[0]).toMatchObject({ bucket: 'third-bucket', accessKeyId: 'third-id', accessKeySecret: 'third-secret' });
  });

  it('sends identical object identity, content and hash to every configured target', async () => {
    const clients = new Map<string, FakeAliyunOssClient>();
    const resolver = createCatalogMediaStorageResolver(credentials(), (configuration) => {
      const client = new FakeAliyunOssClient();
      clients.set(configuration.bucket, client);
      return client;
    });
    const coordinator = new CatalogMediaReplication([
      target('zhudatuan', 'zhudatuan-bucket', 'oss-cn-a.example'),
      target('fufu', 'fufu-bucket', 'oss-cn-b.example'),
    ], resolver);

    const result = await coordinator.replicate({ productId: 'product:42', bytes, contentType: 'image/webp', purpose: 'cover' });
    const uploads = [...clients.values()].map((client) => client.puts[0]!);

    expect(result.overallStatus).toBe('complete');
    expect(uploads.map(({ objectKey }) => objectKey)).toEqual([result.objectKey, result.objectKey]);
    expect(uploads.map(({ options }) => options.meta.sha256)).toEqual([result.sha256, result.sha256]);
    expect(uploads.every(({ bytes: uploaded }) => uploaded.equals(Buffer.from(bytes)))).toBe(true);
  });

  it('uses the same object key on retry', async () => {
    const client = new FakeAliyunOssClient();
    const coordinator = new CatalogMediaReplication(
      [target('zhudatuan', 'zhudatuan-bucket', 'oss-cn-a.example')],
      () => new AliyunOssCatalogMediaStorage(client),
    );
    const input = { mediaId: 'media:42', bytes, contentType: 'image/png', purpose: 'gallery' as const };

    await coordinator.replicate(input);
    await coordinator.replicate(input);

    expect(client.puts.map(({ objectKey }) => objectKey)).toEqual([client.puts[0]!.objectKey, client.puts[0]!.objectKey]);
  });

  it('keeps access key secrets out of results and propagated error text', async () => {
    const secret = 'must-not-appear';
    const client = new FakeAliyunOssClient();
    client.putError = new Error('OSS_UPLOAD_FAILED');
    const resolver = createCatalogMediaStorageResolver({
      CATALOG_MEDIA_ZHUDATUAN_ACCESS_KEY_ID: 'id',
      CATALOG_MEDIA_ZHUDATUAN_ACCESS_KEY_SECRET: secret,
    }, () => client);
    const coordinator = new CatalogMediaReplication(
      [target('zhudatuan', 'zhudatuan-bucket', 'oss-cn-a.example')],
      resolver,
    );

    const result = await coordinator.replicate({ mediaId: 'media:42', bytes, contentType: 'image/png', purpose: 'detail' });

    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.replicas[0]).toMatchObject({ error: 'OSS_UPLOAD_FAILED' });
  });
});

function mediaUpload(): CatalogMediaObjectUpload {
  return { objectKey: 'catalog-media/key', bytes, contentType: 'image/webp', sha256: 'content-sha256' };
}

function target(id: string, bucket: string, endpoint: string): CatalogMediaTarget {
  return { id, provider: 'aliyun-oss', endpoint, region: 'cn-test', bucket, publicBaseUrl: `https://media.${id}.example`, required: true, enabled: true };
}

function credentials(): Readonly<Record<string, string>> {
  return {
    CATALOG_MEDIA_ZHUDATUAN_ACCESS_KEY_ID: 'zhudatuan-id',
    CATALOG_MEDIA_ZHUDATUAN_ACCESS_KEY_SECRET: 'zhudatuan-secret',
    CATALOG_MEDIA_FUFU_ACCESS_KEY_ID: 'fufu-id',
    CATALOG_MEDIA_FUFU_ACCESS_KEY_SECRET: 'fufu-secret',
  };
}

interface PutCall {
  readonly objectKey: string;
  readonly bytes: Buffer;
  readonly options: Readonly<{ mime: string; meta: Readonly<{ sha256: string }> }>;
}

class FakeAliyunOssClient implements AliyunOssClient {
  readonly puts: PutCall[] = [];
  putError: Error | null = null;
  headError: Error | null = null;
  headResult: AliyunOssHeadResult | null = null;

  async put(objectKey: string, uploaded: Buffer, options: PutCall['options']): Promise<void> {
    if (this.putError) throw this.putError;
    this.puts.push({ objectKey, bytes: uploaded, options });
    this.headResult = {
      meta: { sha256: options.meta.sha256 },
      res: { headers: { 'content-length': String(uploaded.byteLength) } },
    };
  }

  async head(): Promise<AliyunOssHeadResult> {
    if (this.headError) throw this.headError;
    return this.headResult ?? { meta: null, res: { headers: {} } };
  }
}
