import type { OperationOutputFor } from '@shop/contract';
import type { StorefrontSession } from '../model/Session';

export interface SessionPort {
  end(session: StorefrontSession, idempotencyKey: string): Promise<OperationOutputFor<'identity.session.delete'>>;
}
