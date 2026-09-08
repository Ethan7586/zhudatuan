import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import type { MarketingChannel } from '../domain/model/Campaign';

export interface MarketingEvaluationInput {
  readonly scope: string;
  readonly member: string;
  readonly channel: MarketingChannel;
  readonly subtotalMinor: number;
  readonly currency: 'CNY';
  readonly memberTags: readonly string[];
  readonly qualificationStates: readonly string[];
  readonly productIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly listingIds: readonly string[];
}
export interface MarketingEvidence {
  readonly id: string;
  readonly version: number;
  readonly discount: number;
}
export interface MarketingEvaluation {
  readonly amountMinor: number;
  readonly evidence: readonly MarketingEvidence[];
}
export interface MarketingReadPort {
  evaluate(context: ReadTransactionContext, input: MarketingEvaluationInput): Promise<MarketingEvaluation>;
  references(context: ReadTransactionContext, campaigns: readonly string[]): Promise<Readonly<{ ready: boolean; version: string }>>;
}
