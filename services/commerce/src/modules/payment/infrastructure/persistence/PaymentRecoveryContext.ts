import type { ProviderOperationPort } from '../../../channel/public';
import type { OrderPaymentJobPort, OrderPaymentPort } from '../../../order/public';
import type { PaymentRecoveryExecution } from '../../application/port/PaymentRecoveryProcess';
import type { PaymentHoldReleaser, PaymentSettlement } from './PaymentSettlement';
import type { RefundSettlement } from './RefundSettlement';

export interface PaymentRecoveryDependencies {
  readonly settlement: PaymentSettlement;
  readonly refundSettlement: RefundSettlement;
  readonly orders: OrderPaymentJobPort & OrderPaymentPort;
  readonly operations: Pick<ProviderOperationPort, 'record' | 'update'>;
  readonly holds: Pick<PaymentHoldReleaser, 'release'>;
}

export function paymentRecoveryOptions(execution: PaymentRecoveryExecution) {
  return {
    tenant: execution.scope,
    membership: '',
    scope: execution.scope,
    actor: 'job:payment',
    trace: execution.trace,
    operation: 'job.payment',
    workload: 'jobs' as const,
    signal: execution.signal,
    deadline: execution.deadline,
  };
}

export function paymentProviderExecution(execution: PaymentRecoveryExecution) {
  return Object.freeze({ requestId: execution.trace, traceId: execution.trace, deadline: execution.deadline, signal: execution.signal });
}
