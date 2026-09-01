import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationSecurityContext } from '../../../foundation/security/OperationSecurityContext';
export interface StorefrontIdentity {
  readonly state: 'anonymous' | 'member';
  readonly member: string | null;
  readonly membership: string | null;
  readonly scope: string | null;
  readonly version: number;
}
export interface IdentityReadPort {
  resolve(security: OperationSecurityContext): StorefrontIdentity;
}
export const IDENTITY_READ_PORT = publicPort<IdentityReadPort>('identity', 'read');
