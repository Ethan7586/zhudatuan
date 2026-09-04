import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface PendingRegistrationMember {
  readonly member: string;
  readonly principal: string;
  readonly displayName: string;
  readonly mobileCiphertext: string | null;
  readonly mobileMasked: string | null;
}

export interface RegistrationMobileOwner {
  readonly member: string;
  readonly principal: string;
}

export interface IdentityRegistrationPort {
  pending(context: ReadTransactionContext, member: string): Promise<PendingRegistrationMember>;
  lockPending(context: WriteTransactionContext, member: string): Promise<PendingRegistrationMember>;
  mobileOwner(context: ReadTransactionContext, fingerprint: string, exceptMember?: string): Promise<RegistrationMobileOwner | null>;
  assertMobileAvailable(context: WriteTransactionContext, fingerprint: string, exceptMember?: string): Promise<void>;
  lockMobile(context: WriteTransactionContext, fingerprint: string): Promise<void>;
  mobile(context: ReadTransactionContext, principal: string): Promise<Readonly<{ ciphertext: string }> | null>;
  createPending(context: WriteTransactionContext, input: Readonly<{ member: string; principal: string; display: string; mobileCiphertext: string; mobileFingerprint: string; mobileMasked: string }>): Promise<void>;
  activate(context: WriteTransactionContext, input: Readonly<{ member: string; principal: string; display: string; mobileCiphertext: string; mobileFingerprint: string; mobileMasked: string }>): Promise<void>;
}

export const IDENTITY_REGISTRATION_PORT = publicPort<IdentityRegistrationPort>('member', 'identityregistration');
