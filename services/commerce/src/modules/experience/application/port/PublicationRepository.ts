import type { ExperienceDocument } from '@shop/contract';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PublishEvidence } from '../../domain/value/PublishEvidence';

export interface PublicationRepository {
  evidence(context: ReadTransactionContext, document: ExperienceDocument, pool: string | null, mall: string): Promise<PublishEvidence>;
}
