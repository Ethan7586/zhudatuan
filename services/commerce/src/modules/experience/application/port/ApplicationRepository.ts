import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ApplicationIdentity } from '../../domain/value/ApplicationIdentity';
import type { ExperiencePage } from '../model/ExperiencePage';

export interface ApplicationRepository {
  create(context: WriteTransactionContext, input: Readonly<{ accessScope: string; actor: string; name: string; identity: ApplicationIdentity }>): Promise<Readonly<Record<string, unknown>>>;
  copy(context: WriteTransactionContext, input: Readonly<{ source: string; actor: string; name: string; reason: string; identity: ApplicationIdentity }>): Promise<Readonly<Record<string, unknown>>>;
  read(context: ReadTransactionContext, input: Readonly<{ scope: string; application: string; page: ExperiencePage }>): Promise<readonly Readonly<Record<string, unknown>>[]>;
  update(context: WriteTransactionContext, input: Readonly<{ id: string; name: string | null; status: string | null; expectedVersion: number | null }>): Promise<Readonly<Record<string, unknown>>>;
}
