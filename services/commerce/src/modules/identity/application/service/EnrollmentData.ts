import type { IdentityEnrollmentsCompleteBody } from '@shop/contract';
import { ApplicationError } from '../../../../foundation/domain/ApplicationError';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CipherEnvelope } from '../../../../foundation/infrastructure/KmsClient';
import type { AuthTransaction } from '../../domain/model/AuthTransaction';

export interface EnrollmentDraft {
  readonly invitation: string;
  readonly scope: string;
  readonly mode: 'bound' | 'campaign';
  readonly body: IdentityEnrollmentsCompleteBody;
  readonly subject: string;
  readonly password: string;
  readonly mobile: CipherEnvelope;
  readonly principal: string;
  readonly display: string;
  readonly authorization: AuthTransaction;
  readonly returnTarget: string;
}

export interface EnrollmentInvitationScope {
  readonly invitation: string;
  readonly scope: string;
  readonly mode: 'bound' | 'campaign';
  readonly principal: string | null;
  readonly mobileCiphertext: string | null;
  readonly displayName: string | null;
}

export function maskEnrollmentSubject(value: string): string {
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
}

export async function concealEnrollmentAccess<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (cause) {
    if (cause instanceof ApplicationError) throw new DomainError('INVITATION_INVALID');
    throw cause;
  }
}
