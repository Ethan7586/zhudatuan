import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AccessContext } from '../../../../foundation/security/AccessContext';
import type { NavigationProjection } from '../service/NavigationProjector';

export interface NavigationProjectionRepository {
  project(context: ReadTransactionContext, access: AccessContext, scope: string, signal?: AbortSignal): Promise<NavigationProjection>;
}
