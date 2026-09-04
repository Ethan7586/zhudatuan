import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MallProvisionSnapshot } from '../../../organization/public';

export interface ExperienceProvisionRepository {
  provision(context: WriteTransactionContext, input: Readonly<{ event: string; mall: MallProvisionSnapshot; actor: string }>): Promise<'created' | 'synchronized' | 'replayed'>;
}
