import { hasFailureCode } from '@shop/presentation';
import type { ReferralAttributionInput, ReferralAttributionResult } from './model/Referral';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,1536}\.[A-Za-z0-9_-]{32,512}$/;

export type ReferralBindingExecutor = (token: string) => Promise<unknown>;

export class ReferralAttributionCoordinator {
  private readonly attempted = new Set<string>();

  constructor(private readonly bind: ReferralBindingExecutor) {}

  async capture(input: ReferralAttributionInput): Promise<ReferralAttributionResult> {
    const candidate = referralCandidate(input.search);
    if (candidate.status !== 'candidate') return candidate;
    if (!trustedIdentity(input.mallId) || !trustedIdentity(input.memberId)) return { status: 'ignored', reason: 'untrusted-context' };

    const attempt = JSON.stringify([input.mallId, input.memberId, candidate.value]);
    if (this.attempted.has(attempt)) return { status: 'deduplicated' };
    this.attempted.add(attempt);
    try {
      await this.bind(candidate.value);
      return { status: 'bound', candidateWon: true };
    } catch (cause) {
      if (hasFailureCode(cause, 'REFERRAL_ALREADY_BOUND')) return { status: 'bound', candidateWon: false };
      this.attempted.delete(attempt);
      return { status: 'failed' };
    }
  }
}

export function referralCandidate(search: string): Readonly<{ status: 'candidate'; value: string }> | Readonly<{ status: 'ignored'; reason: 'absent' | 'malformed' }> {
  const values = new URLSearchParams(search).getAll('referral');
  if (values.length === 0) return { status: 'ignored', reason: 'absent' };
  if (values.length !== 1 || values[0].length > 2048 || !TOKEN_PATTERN.test(values[0])) return { status: 'ignored', reason: 'malformed' };
  return { status: 'candidate', value: values[0] };
}

function trustedIdentity(value: string): boolean {
  return value.length > 0 && value.length <= 255 && value.trim() === value;
}
