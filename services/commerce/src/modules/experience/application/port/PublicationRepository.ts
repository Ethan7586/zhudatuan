import type { ExperienceDocument } from '@shop/contract';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface PublicationRepository {
  references(context: ReadTransactionContext, document: ExperienceDocument, pool: string): Promise<boolean>;
}
