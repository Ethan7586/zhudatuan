import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface AccessPartnerScope {
  readonly id: string;
  readonly kind: 'supplier' | 'brand' | 'store';
  readonly organization: string;
}
export interface AccessPartnerPort {
  invitationScope(database: OperationDatabase, partner: string): Promise<AccessPartnerScope | null>;
}
export const ACCESS_PARTNER_PORT = publicPort<AccessPartnerPort>('partner', 'access');
