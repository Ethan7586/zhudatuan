import { createHash, randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { PgTransactionAccess, type SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import type { OperationRequest, OperationResult } from '../../../../pipeline/OperationHandler';
import type { KmsClient } from '../../../../pipeline/KmsPort';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { PaymentContinuation } from '../../application/port/PaymentContinuation';
import type { PaymentGateway } from '../../application/port/PaymentGateway';
import { PaymentHoldReleaser, PaymentSettlement } from './PaymentSettlement';
import type { SettlementOrders } from './PaymentSettlementCore';
import { PaymentReference } from '../../domain/model/PaymentReference';
import { PaymentAttempt } from '../../domain/model/PaymentAttempt';
import { transportErrorCode } from '../../../../platform/error/SafeError';
import type { PaymentScene } from '../../public';
import type { MemberAccessPort } from '../../../access/public';
import type { OrderPaymentPort } from '../../../order/public';
import type { PaymentIdentityPort } from '../../../identity/public';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { sessionAccess } from '../../../../platform/security/OperationSecurityContext';

export interface IntentState {
  readonly intent: string;
  readonly attempt: string | null;
  readonly sequence: number | null;
  readonly order_id: string;
  readonly order_number: string;
  readonly scope_id: string;
  readonly mall_id: string;
  readonly member_id: string;
  readonly total_minor: number;
  readonly amount_minor: number;
  readonly payer_identity: string | null;
  readonly payer_ciphertext: string | null;
  readonly state: string | null;
  readonly parameters: unknown | null;
  readonly scene: PaymentScene | null;
  readonly application_hash: string | null;
  readonly expires_at: string;
}
export interface PaymentOrders extends SettlementOrders {
  payment: OrderPaymentPort['payment'];
  lockPayment: OrderPaymentPort['lockPayment'];
  markAuthorizing(context: WriteTransactionContext, order: string): Promise<void>;
  resetPayment(context: WriteTransactionContext, order: string): Promise<void>;
}

export function providerExecution(request: OperationRequest) {
  const trace = sessionAccess(request.security)?.trace ?? request.input.headers['request-id'] ?? request.type;
  return Object.freeze({ requestId: request.input.headers['request-id'] ?? trace, traceId: trace, deadline: request.input.deadline, signal: request.input.signal });
}

export function wechatTime(value: string): string {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) throw new Error('PAYMENT_EXPIRY_INVALID');
  return time.toISOString().replace('Z', '+00:00');
}

export function providerOutcomeUnknown(cause: unknown): boolean {
  return /(?:NETWORK|TIMEOUT|DEADLINE|TRANSPORT)/.test(transportErrorCode(cause) ?? '');
}
