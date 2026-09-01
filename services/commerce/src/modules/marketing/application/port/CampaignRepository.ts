import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface CampaignRecord extends Record<string, unknown> {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly state: string;
  readonly budget_minor: number;
  readonly spent_minor: number;
  readonly currency: string;
  readonly effective_at: string;
  readonly expires_at: string | null;
  readonly version: number;
  readonly updated_at: string;
}

export interface CampaignRepository {
  read(context: ReadTransactionContext, scope: string, cursor: Readonly<{ sort: string | null; id: string | null; fetch: number }>): Promise<readonly CampaignRecord[]>;
}
