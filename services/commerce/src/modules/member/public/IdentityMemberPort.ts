import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface IdentityMemberPort {
  memberForPrincipal(database: OperationDatabase, principal: string): Promise<string>;
  updateDisplay(database: OperationDatabase, member: string, display: string): Promise<Readonly<Record<string, unknown>>>;
  securityProfile(database: OperationDatabase, principal: string): Promise<Readonly<{ mobileCiphertext: string | null; mobileFingerprint: string | null }>>;
  changeMobile(database: OperationDatabase, principal: string, ciphertext: string, fingerprint: string, masked: string): Promise<Readonly<Record<string, unknown>>>;
}

export const IDENTITY_MEMBER_PORT = publicPort<IdentityMemberPort>('member', 'identity');
