import { createIdempotencyKey, type RequestScope } from '@shop/sdk/context';
import { uploadImportFile, validateImportFile as validateFile, type UploadedImport as UploadedFile } from '@shop/sdk/files';
import { createFetchRuntime } from '@shop/sdk/runtime';
import { consoleCommand } from '../api/RequestContext';

export type UploadedImport = UploadedFile;

export interface ImportUploadContext {
  readonly scope: RequestScope;
  readonly session: Readonly<{ accessVersion: number; csrf?: string | undefined }>;
}

export class ImportUploadGateway {
  private readonly runtime;

  constructor(baseUrl: string) { this.runtime = createFetchRuntime(baseUrl); }

  async upload(context: ImportUploadContext, file: File, signal?: AbortSignal, progress?: (processed: number) => void, identity?: string): Promise<UploadedImport> {
    return uploadImportFile(
      this.runtime,
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        idempotencyKey: identity ?? createIdempotencyKey(),
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      }),
      file,
      progress
    );
  }
}

export function validateImportFile(file: File): string | undefined {
  try {
    validateFile(file);
    return undefined;
  } catch (cause) {
    return cause instanceof Error ? cause.message : '文件类型无效。';
  }
}
