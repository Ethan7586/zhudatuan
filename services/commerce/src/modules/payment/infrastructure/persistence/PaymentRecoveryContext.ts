import type { ProviderOperationPort } from '../../../channel/public';
import type { PaymentJobOrderPort, PaymentOrderPort } from '../../../order/public';
import type { PaymentRecoveryExecution } from '../../application/port/PaymentRecoveryProcess';
import type { PaymentHoldReleaser, PaymentSettlement } from './PaymentSettlement';
import type { RefundSettlement } from './RefundSettlement';

export interface PaymentRecoveryDependencies {
  readonly settlement: PaymentSettlement;
  readonly refundSettlement: RefundSettlement;
  readonly orders: PaymentJobOrderPort & PaymentOrderPort;
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
