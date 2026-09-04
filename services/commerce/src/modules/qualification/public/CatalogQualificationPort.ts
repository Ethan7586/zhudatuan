import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface CatalogQualificationSubject {
  readonly listing: string;
  readonly product: string;
  readonly category: string;
  readonly partner: string | null;
  readonly regions: readonly string[];
}

export interface CatalogQualificationDecision {
  readonly listing: string;
  readonly eligible: boolean;
  readonly policyVersion: number;
}

export interface CatalogQualificationPort {
  decisions(context: ReadTransactionContext, scope: string, subjects: readonly CatalogQualificationSubject[]): Promise<readonly CatalogQualificationDecision[]>;
}

export const CATALOG_QUALIFICATION_PORT = publicPort<CatalogQualificationPort>('qualification', 'catalog');
