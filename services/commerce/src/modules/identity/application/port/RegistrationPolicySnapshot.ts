import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { RegistrationPolicyRecord } from './RegistrationPolicyRepository';

export interface RegistrationPolicySnapshot {
  current(context: ExecutionContext<'identity.bootstrap.read'>): Promise<RegistrationPolicyRecord | null>;
}
