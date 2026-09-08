import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { AccessContext } from '../../../../platform/security/AccessContext';
import type { NavigationProjection } from '../service/NavigationProjector';

export interface NavigationProjectionRepository {
  project(context: ReadTransactionContext, access: AccessContext, scope: string, signal?: AbortSignal): Promise<NavigationProjection>;
}
