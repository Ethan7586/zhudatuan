import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface PendingInvitationMember {
  readonly member: string;
  readonly principal: string;
  readonly mobileCiphertext: string | null;
}
export interface InvitationMobileOwner {
  readonly member: string;
  readonly principal: string;
}
export interface InvitationMemberPort {
  pending(context: ReadTransactionContext, member: string): Promise<PendingInvitationMember>;
  lockPending(context: WriteTransactionContext, member: string): Promise<PendingInvitationMember>;
  mobileOwner(context: ReadTransactionContext, fingerprint: string, exceptMember?: string): Promise<InvitationMobileOwner | null>;
  assertMobileAvailable(context: ReadTransactionContext, fingerprint: string, exceptMember?: string): Promise<void>;
  createPending(context: WriteTransactionContext, input: Readonly<{ member: string; principal: string; display: string; mobileCiphertext: string; mobileFingerprint: string; mobileMasked: string }>): Promise<void>;
  activate(context: WriteTransactionContext, input: Readonly<{ member: string; principal: string; display: string; mobileCiphertext: string; mobileFingerprint: string; mobileMasked: string }>): Promise<void>;
}
export const INVITATION_MEMBER_PORT = publicPort<InvitationMemberPort>('member', 'identityinvitation');
