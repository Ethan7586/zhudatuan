import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface PreparedImportObject { readonly reference: string; readonly sha256: string; readonly name: string; readonly mediaType: string; readonly size: number }
export interface ImportObjectRequest { readonly body?: unknown; readonly query?: Readonly<Record<string, unknown>> }
export interface ImportObjectPort {
  prepare(input: ImportObjectRequest, tenant?: string): Promise<PreparedImportObject>;
}

export const IMPORT_OBJECT_PORT = publicPort<ImportObjectPort>('runtime', 'importobject');
