import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

import type { LinkCase, LinkCaseReason } from '../../domain/model/LinkCase';
export interface LinkCaseRepository {
  create(context: WriteTransactionContext, provider: string, tenant: string, subjecthash: Buffer, reason: LinkCaseReason, transaction?: string): Promise<LinkCase>;
  enrollment(context: WriteTransactionContext, organization: string, reference: string, subjecthash: Buffer, candidatePrincipal: string | null): Promise<LinkCase>;
  decide(context: WriteTransactionContext, value: LinkCase): Promise<void>;
}
