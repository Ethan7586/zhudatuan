import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface PublicationTarget {
  readonly application: string;
  readonly configuration: unknown;
  readonly hash: string;
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
  complete(context: WriteTransactionContext, event: string): Promise<void>;
}
