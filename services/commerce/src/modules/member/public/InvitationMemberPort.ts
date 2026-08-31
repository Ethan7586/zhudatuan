import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

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
  pending(database: OperationDatabase, member: string): Promise<PendingInvitationMember>;
  mobileOwner(database: OperationDatabase, fingerprint: string, exceptMember?: string): Promise<InvitationMobileOwner | null>;
  assertMobileAvailable(database: OperationDatabase, fingerprint: string, exceptMember?: string): Promise<void>;
  createPending(database: OperationDatabase, input: Readonly<{ member: string; principal: string; display: string; mobileCiphertext: string; mobileFingerprint: string; mobileMasked: string }>): Promise<void>;
  activate(database: OperationDatabase, input: Readonly<{ member: string; principal: string; display: string; mobileCiphertext: string; mobileFingerprint: string; mobileMasked: string }>): Promise<void>;
}
export const INVITATION_MEMBER_PORT = publicPort<InvitationMemberPort>('member', 'identityinvitation');
