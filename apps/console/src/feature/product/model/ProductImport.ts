import type { OperationOutputFor } from '@shop/contract';
import type { DeepReadonly } from './Product';

type ImportTask = DeepReadonly<OperationOutputFor<'runtime.imports.read'>>;
type ImportEvidence = DeepReadonly<Pick<OperationOutputFor<'catalog.imports.read'>, 'last_error' | 'errors' | 'report'>>;

export type ProductImport = Readonly<ImportTask & ImportEvidence>;
export type ProductImportTemplate = Readonly<{
  readonly title: string;
  readonly description: string;
  readonly columns: readonly string[];
}>;
