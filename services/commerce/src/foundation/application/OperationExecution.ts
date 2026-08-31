import type { OperationId } from '@shop/contract';
import type { OperationSecurityContext } from '../security/OperationSecurityContext';

export interface OperationInput {
  readonly path: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string | readonly string[]>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly rawBody: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
  readonly publicActor?: string;
  readonly idempotency?: string;
  readonly expectedVersion?: number;
}

export interface OperationRequest {
  readonly type: OperationId;
  readonly input: OperationInput;
  readonly security: OperationSecurityContext;
}

export interface OperationResult {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface OperationUsecase {
  invoke(request: OperationRequest): Promise<OperationResult>;
}
