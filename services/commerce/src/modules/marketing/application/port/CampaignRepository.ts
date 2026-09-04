import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CampaignRevision, CampaignSnapshot } from '../../domain/model/Campaign';

export interface CampaignRecord extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly kind: CampaignSnapshot['kind'];
  readonly name: string;
  readonly state: CampaignSnapshot['state'];
  readonly budget_minor: number;
  readonly spent_minor: number;
  readonly available_minor: number;
  readonly currency: 'CNY';
  readonly rule: CampaignSnapshot['rule'];
  readonly effective_at: string;
  readonly expires_at: string | null;
  readonly version: number;
  readonly budget_version: number;
  readonly published_at: string | null;
  readonly disabled_at: string | null;
  readonly disable_reason: string | null;
  readonly created_by: string;
  readonly updated_by: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CampaignRepository {
  read(context: ReadTransactionContext, scope: string, cursor: Readonly<{ sort: string | null; id: string | null; fetch: number }>): Promise<readonly CampaignRecord[]>;
  create(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; revision: CampaignRevision; actor: string }>): Promise<CampaignRecord>;
  revise(context: WriteTransactionContext, scope: string, id: string, expectedVersion: number, revision: CampaignRevision): Promise<CampaignRecord | null>;
  publish(context: WriteTransactionContext, scope: string, id: string, expectedVersion: number, actor: string): Promise<CampaignRecord | null>;
  disable(context: WriteTransactionContext, scope: string, id: string, expectedVersion: number, actor: string, reason: string): Promise<CampaignRecord | null>;
}
