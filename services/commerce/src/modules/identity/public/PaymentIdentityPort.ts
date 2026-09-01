import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface PaymentIdentityPort {
  subject(context: ReadTransactionContext, principal: string, applicationHash: string): Promise<PaymentIdentitySubject | null>;
}
export interface PaymentIdentitySubject {
  readonly id: string;
  readonly ciphertext: string;
}
export const PAYMENT_IDENTITY_PORT = publicPort<PaymentIdentityPort>('identity', 'payment');
