import type { TransactionContext } from '../persistence/UnitOfWork';
import type { OperationSecurityContext } from '../security/OperationSecurityContext';

export interface OperationContext {
  readonly requestId: string;
  readonly traceId: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
  readonly security: OperationSecurityContext;
  readonly headers: Readonly<Record<string, string>>;
  readonly rawBody: string;
  readonly publicActor?: string;
  readonly transaction?: TransactionContext;
  readonly idempotencyKey?: string;
  readonly expectedVersion?: number;
}
