import { IMPORT_CAPACITY } from '@shop/config/runtime';
import { createIdempotencyKey, uploadObject } from '@shop/sdk';
import type { RequestScope } from '@shop/sdk/context';
import { createFetchRuntime } from '@shop/sdk/runtime';
import type { OperationBodyFor } from '@shop/contract';
import { consoleCommand } from '../api/RequestContext';
import { hashFile } from './Sha256';

export interface UploadedImport {
  readonly objectRef: string;
  readonly sha256: string;
  readonly fileName: string;
  readonly mediaType: ImportMediaType;
  readonly size: number;
}

export interface ImportUploadContext {
  readonly scope: RequestScope;
  readonly session: Readonly<{ accessVersion: number; csrf?: string | undefined }>;
}

export class ImportUploadGateway {
  private readonly runtime;

  constructor(baseUrl: string) { this.runtime = createFetchRuntime(baseUrl); }

  async upload(context: ImportUploadContext, file: File, signal?: AbortSignal, progress?: (processed: number) => void, identity?: string): Promise<UploadedImport> {
    const validation = validateImportFile(file);
    if (validation) throw new Error(validation);
    const contentType = importContentType(file);
    const sha256 = await hashFile(file, signal, progress);
    const intent = await this.runtime.uploadsCreate(
      { body: { name: file.name, contentType, size: file.size, sha256 } },
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        idempotencyKey: identity ?? createIdempotencyKey(),
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      })
    );
    await uploadObject({ url: intent.upload.url, headers: intent.upload.headers, body: file, ...(signal === undefined ? {} : { signal }) }).catch(() => {
      throw new Error('文件上传失败，请检查网络后重新选择文件。');
    });
    return Object.freeze({ objectRef: intent.reference, sha256, fileName: file.name, mediaType: contentType, size: file.size });
  }
}

export function validateImportFile(file: File): string | undefined {
  let contentType: ReturnType<typeof importContentType>;
  try { contentType = importContentType(file); } catch (cause) { return cause instanceof Error ? cause.message : '文件类型无效。'; }
  const maximum = contentType === 'text/csv' ? IMPORT_CAPACITY.maximumFileBytes : IMPORT_CAPACITY.maximumSpreadsheetBytes;
  if (file.size < 1 || file.size > maximum) return contentType === 'text/csv' ? 'CSV 文件不可为空且不得超过 1 GiB。' : 'XLSX 文件不可为空且不得超过 32 MiB。';
  return undefined;
}

type ImportMediaType = OperationBodyFor<'RuntimeUploadsCreateInput'>['contentType'];

function importContentType(file: File): ImportMediaType {
  const suffix = file.name.normalize('NFKC').toLowerCase();
  if (suffix.endsWith('.csv') && (file.type === '' || file.type === 'text/csv' || file.type === 'application/csv')) return 'text/csv';
  if (suffix.endsWith('.xlsx') && (file.type === '' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  throw new Error('仅支持扩展名与内容类型一致的 CSV 或 XLSX 文件。');
}
