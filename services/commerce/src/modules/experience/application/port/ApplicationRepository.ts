import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ApplicationIdentity } from '../../domain/value/ApplicationIdentity';
import type { ExperiencePage } from '../model/ExperiencePage';
import type { ApplicationDetail, ApplicationSummary } from '../model/ApplicationSummary';

export interface ApplicationRepository {
  create(context: WriteTransactionContext, input: Readonly<{ accessScope: string; actor: string; name: string; identity: ApplicationIdentity }>): Promise<ApplicationSummary>;
  copy(context: WriteTransactionContext, input: Readonly<{ source: string; actor: string; name: string; reason: string; identity: ApplicationIdentity }>): Promise<ApplicationSummary & { readonly versionId: string }>;
  readSummaries(context: ReadTransactionContext, input: Readonly<{ scope: string; application: string; page: ExperiencePage }>): Promise<readonly ApplicationSummary[]>;
  detail(context: ReadTransactionContext, input: Readonly<{ scope: string; application: string }>): Promise<ApplicationDetail>;
  update(context: WriteTransactionContext, input: Readonly<{ id: string; name: string | null; status: string | null; expectedVersion: number | null }>): Promise<ApplicationSummary>;
}
