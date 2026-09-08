import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ExperienceDocument } from '@shop/contract';

export interface PublicationTarget {
  readonly application: string;
  readonly configuration: ExperienceDocument;
  readonly hash: string;
  readonly pool: string;
  readonly effectiveAt: string;
  readonly release: string;
  readonly state: string;
  readonly version: string;
}

export interface PublicationObject {
  readonly reference: string;
  readonly sha256: string;
  readonly size: number;
}

export interface ExperiencePublicationRepository {
  target(context: ReadTransactionContext, release: string): Promise<PublicationTarget | undefined>;
  activate(context: WriteTransactionContext, event: string, target: PublicationTarget, path: string, object: PublicationObject): Promise<Readonly<{ active: boolean; malls: readonly string[]; handles: readonly string[] }>>;
  fail(context: WriteTransactionContext, event: string, target: PublicationTarget, code: string): Promise<void>;
  complete(context: WriteTransactionContext, event: string): Promise<void>;
}
