import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface OrderExpiryCheckoutPort {
  expire(context: WriteTransactionContext, checkout: string | null): Promise<readonly Readonly<{ id: string }>[]>;
}

export interface CheckoutRetentionPort {
  purge(context: WriteTransactionContext): Promise<readonly string[]>;
}

export const RUNTIME_CHECKOUT_PORT = publicPort<CheckoutRetentionPort>('checkout', 'runtime');
