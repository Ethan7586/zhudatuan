import { DomainError } from '../../../../platform/error/DomainError';
import type { VerificationChannel, VerificationPurpose } from '../model/VerificationSession';

export interface VerificationRule {
  readonly purpose: VerificationPurpose;
  readonly operation: string;
  readonly channel: VerificationChannel;
  readonly ttlSeconds: number;
  readonly proofSeconds: number;
  readonly maximumAttempts: number;
  readonly minimumAssurance: 2 | 3;
}

const rules: Readonly<Record<VerificationPurpose, VerificationRule>> = Object.freeze({
  member_code: Object.freeze({ purpose: 'member_code', operation: 'verification.member.inspect', channel: 'qrcode', ttlSeconds: 60, proofSeconds: 60, maximumAttempts: 5, minimumAssurance: 2 }),
  voucher_redeem: Object.freeze({ purpose: 'voucher_redeem', operation: 'voucher.redemptions.create', channel: 'qrcode', ttlSeconds: 60, proofSeconds: 60, maximumAttempts: 5, minimumAssurance: 2 }),
  login: Object.freeze({ purpose: 'login', operation: 'identity.sessions.create', channel: 'sms', ttlSeconds: 300, proofSeconds: 300, maximumAttempts: 5, minimumAssurance: 2 }),
  sensitive_action: Object.freeze({ purpose: 'sensitive_action', operation: 'access.actions.execute', channel: 'sms', ttlSeconds: 300, proofSeconds: 300, maximumAttempts: 5, minimumAssurance: 3 }),
  financial_approval: Object.freeze({ purpose: 'financial_approval', operation: 'finance.approvals.decide', channel: 'app', ttlSeconds: 180, proofSeconds: 180, maximumAttempts: 3, minimumAssurance: 3 }),
});

export class VerificationPolicy {
  resolve(purpose: VerificationPurpose, operation?: string): VerificationRule {
    const rule = rules[purpose];
    if (!rule || (operation !== undefined && operation !== rule.operation)) throw new DomainError('CHALLENGE_PURPOSE_INVALID');
    return rule;
  }
}
