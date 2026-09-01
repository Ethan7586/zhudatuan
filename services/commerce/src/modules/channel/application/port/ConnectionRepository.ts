import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { QueryPage } from '../../../../foundation/interface/Validation';
import type { ConnectionState } from '../../domain/model/Connection';

export interface ConnectionConfiguration {
  readonly region: string;
  readonly baseUrl: string | null;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly healthOperation: string;
  readonly document: Readonly<Record<string, unknown>>;
}

export interface ConnectionRepository {
  create(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; provider: string; scope: string; actor: string; trace: string; secretRef: string | null; configuration: ConnectionConfiguration }>
  ): Promise<Readonly<Record<string, unknown>>>;
  update(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; actor: string; trace: string; secretRef: string | null; configuration: ConnectionConfiguration; expectedVersion: number | null }>
  ): Promise<Readonly<Record<string, unknown>>>;
  read(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  transition(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; actor: string; trace: string; state: ConnectionState; expectedVersion: number | null }>): Promise<Readonly<Record<string, unknown>>>;
}
