import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationSecurityContext } from '../../../foundation/security/OperationSecurityContext';
export interface StorefrontIdentity {
  readonly state: 'anonymous' | 'member';
  readonly member: string | null;
  readonly membership: string | null;
  readonly scope: string | null;
  readonly version: number;
  readonly csrf?: string;
}
export interface IdentityReadPort {
  resolve(security: OperationSecurityContext, headers: Readonly<Record<string, string>>): StorefrontIdentity;
}
export const IDENTITY_READ_PORT = publicPort<IdentityReadPort>('identity', 'read');
