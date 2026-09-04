import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface IdentityMemberPort {
  memberForPrincipal(context: ReadTransactionContext, principal: string): Promise<string>;
  registrationPrincipal(context: ReadTransactionContext, member: string): Promise<string>;
  releaseRegistration(context: WriteTransactionContext, member: string, principal: string): Promise<Readonly<{ version: number }>>;
  updateDisplay(context: WriteTransactionContext, member: string, display: string): Promise<Readonly<Record<string, unknown>>>;
  securityProfile(context: ReadTransactionContext, principal: string): Promise<Readonly<{ mobileCiphertext: string | null; mobileFingerprint: string | null }>>;
  changeMobile(context: WriteTransactionContext, principal: string, ciphertext: string, fingerprint: string, masked: string): Promise<Readonly<Record<string, unknown>>>;
}

export const IDENTITY_MEMBER_PORT = publicPort<IdentityMemberPort>('member', 'identity');
