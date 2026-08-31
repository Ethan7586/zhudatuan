import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface ReferralReadPort {
  binding(scopeId: string, customerId: string): Promise<Readonly<{ promoterId: string; version: number }> | null>;
}

export const REFERRAL_READ_PORT = publicPort<ReferralReadPort>('referral', 'read');
