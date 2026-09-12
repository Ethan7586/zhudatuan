import type {
  CatalogMediaObjectStorage,
  CatalogMediaObjectUpload,
  CatalogMediaStoredObject,
} from '../../03_application_yingyong/port/CatalogMediaObjectStorage';

export interface AliyunOssHeadResult {
  readonly meta?: Readonly<Record<string, unknown>> | null;
  readonly res?: {
    readonly headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
  };
}

export interface AliyunOssClient {
  put(
    objectKey: string,
    bytes: Buffer,
    options: Readonly<{ mime: string; meta: Readonly<{ sha256: string }> }>,
  ): Promise<unknown>;
  head(objectKey: string): Promise<AliyunOssHeadResult>;
}

export class AliyunOssCatalogMediaStorage implements CatalogMediaObjectStorage {
  constructor(private readonly client: AliyunOssClient) {}

  async upload(input: CatalogMediaObjectUpload): Promise<void> {
    const bytes = Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength);
    await this.client.put(input.objectKey, bytes, {
      mime: input.contentType,
      meta: { sha256: input.sha256 },
    });
  }

  async inspect(objectKey: string): Promise<CatalogMediaStoredObject> {
    try {
      const object = await this.client.head(objectKey);
      const contentLength = header(object.res?.headers?.['content-length']);
      const sha256 = object.meta?.sha256;
      return Object.freeze({
        exists: true,
        byteSize: Number.parseInt(contentLength ?? '', 10),
        sha256: typeof sha256 === 'string' ? sha256 : null,
      });
    } catch (cause) {
      if (isMissingObject(cause)) return Object.freeze({ exists: false, byteSize: 0, sha256: null });
      throw cause;
    }
  }
}

function header(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

function isMissingObject(cause: unknown): boolean {
  if (cause === null || typeof cause !== 'object') return false;
  const error = cause as Readonly<{ code?: unknown; status?: unknown; statusCode?: unknown }>;
  if (error.code === 'NoSuchKey') return true;
  return error.code === undefined && (error.status === 404 || error.statusCode === 404);
}
