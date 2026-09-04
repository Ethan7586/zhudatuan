import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface TabularFilePort {
  batches(reference: string, sha256: string): AsyncIterable<readonly Readonly<Record<string, string>>[]>;
}

export const TABULAR_FILE_PORT = publicPort<TabularFilePort>('runtime', 'tabularfile');
