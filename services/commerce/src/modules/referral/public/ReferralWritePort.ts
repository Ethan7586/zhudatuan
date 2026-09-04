import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { ReferralSource } from '../domain/model/ReferralBinding';

export interface ReferralWritePort {
  bind(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scopeId: string; customerId: string; promoterId: string; fingerprint: string; source: ReferralSource; boundAt: string; expiresAt: string | null }>
  ): Promise<Readonly<{ id: string; version: number }> | null>;
}

export const REFERRAL_WRITE_PORT = publicPort<ReferralWritePort>('referral', 'write');
