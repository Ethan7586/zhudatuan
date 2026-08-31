import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface ReferralWritePort {
  accept(event: Readonly<{ eventId: string; eventType: string; scopeId: string; payload: Readonly<Record<string, unknown>> }>): Promise<boolean>;
}

export const REFERRAL_WRITE_PORT = publicPort<ReferralWritePort>('referral', 'write');
