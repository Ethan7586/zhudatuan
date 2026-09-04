import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExperiencePage } from '../model/ExperiencePage';
import type { ApplicationDetail, ApplicationSummary } from '../model/ApplicationSummary';

export interface ApplicationRepository {
  create(context: WriteTransactionContext, input: Readonly<{ mall: string; actor: string }>): Promise<ApplicationSummary>;
  copy(context: WriteTransactionContext, input: Readonly<{ source: string; targetMall: string; actor: string; reason: string }>): Promise<ApplicationSummary & { readonly versionId: string }>;
  readSummaries(context: ReadTransactionContext, input: Readonly<{ scope: string; application: string; page: ExperiencePage }>): Promise<readonly ApplicationSummary[]>;
  detail(context: ReadTransactionContext, input: Readonly<{ scope: string; application: string }>): Promise<ApplicationDetail>;
  update(context: WriteTransactionContext, input: Readonly<{ id: string; name: string | null; status: string | null; expectedVersion: number | null }>): Promise<ApplicationSummary>;
}
