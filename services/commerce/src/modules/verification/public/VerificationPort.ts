import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';
import type { VerificationChannel, VerificationPurpose } from '../domain/model/VerificationSession';

export interface VerificationRequirement {
  readonly purpose: VerificationPurpose;
  readonly operation: string;
  readonly channel: VerificationChannel;
  readonly ttlSeconds: number;
  readonly minimumAssurance: 2 | 3;
}

export interface VerificationPort {
  request(input: Readonly<{ purpose: VerificationPurpose; operation: string }>): VerificationRequirement;
  verify(
    context: WriteTransactionContext,
    input: Readonly<{ proof: string; scope: string; subjectType: 'member' | 'voucher' | 'principal' | 'resource'; subject: string; purpose: VerificationPurpose; operation: string; actor: string; now?: Date }>
  ): Promise<Readonly<{ verification: string; expiresAt: string }>>;
}

export const VERIFICATION_PORT = publicPort<VerificationPort>('verification', 'proof');
