import type { ExperienceDocument } from '@shop/contract';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface PublishableVersion {
  readonly application: string;
  readonly validation: string;
  readonly configuration: unknown;
  readonly pool: string | null;
}

export interface VersionRepository {
  save(context: WriteTransactionContext, input: Readonly<{ application: string; expectedVersion: number; document: ExperienceDocument; reason: string; actor: string }>): Promise<Readonly<Record<string, unknown>>>;
  validate(context: WriteTransactionContext, version: string): Promise<Readonly<Record<string, unknown>>>;
  publishable(context: WriteTransactionContext, version: string, expectedVersion: number): Promise<PublishableVersion>;
  restore(context: WriteTransactionContext, input: Readonly<{ version: string; expectedVersion: number; reason: string; actor: string }>): Promise<Readonly<Record<string, unknown>>>;
}
