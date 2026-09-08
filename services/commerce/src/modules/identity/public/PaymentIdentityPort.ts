import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface PaymentIdentityPort {
  subject(context: ReadTransactionContext, principal: string, applicationHash: string): Promise<PaymentIdentitySubject | null>;
}
export interface PaymentIdentitySubject {
  readonly id: string;
  readonly ciphertext: string;
}
export const PAYMENT_IDENTITY_PORT = publicPort<PaymentIdentityPort>('identity', 'payment');
