import { createIdempotencyKey, createRequestContext } from '@shop/sdk/context';
import { createFetchReferralBindingsCreate } from '@shop/sdk/referral';

const STOREFRONT_CLIENT_VERSION = '0.0.0';
const REFERRAL_MEMBER_PATTERN = /^referral-member:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface ReferralAttributionInput {
  readonly search: string;
  /** Trusted mall identity from the authenticated bootstrap, never from the URL. */
  readonly mallId: string;
  /** Trusted member identity from the authenticated bootstrap, never from the URL. */
  readonly memberId: string;
}

export type ReferralAttributionResult =
  | Readonly<{ status: 'ignored'; reason: 'absent' | 'malformed' | 'untrusted-context' }>
  | Readonly<{ status: 'deduplicated' }>
  | Readonly<{ status: 'bound'; candidateWon: boolean | null }>
  | Readonly<{ status: 'failed' }>;

export type ReferralBindingExecutor = (candidateReferralMemberId: string) => Promise<unknown>;

/**
 * Keeps URL parsing and client replay suppression separate from the server's
 * authoritative first-touch decision. A failed attribution never escapes to
 * the storefront render path.
 */
export class ReferralAttributionCoordinator {
  private readonly attempted = new Set<string>();

  constructor(private readonly bind: ReferralBindingExecutor) {}

  async capture(input: ReferralAttributionInput): Promise<ReferralAttributionResult> {
    const candidate = referralCandidate(input.search);
    if (candidate.status !== 'candidate') return candidate;
    if (!trustedIdentity(input.mallId) || !trustedIdentity(input.memberId)) {
      return { status: 'ignored', reason: 'untrusted-context' };
    }

    const attempt = JSON.stringify([input.mallId, input.memberId, candidate.value]);
    if (this.attempted.has(attempt)) return { status: 'deduplicated' };
    this.attempted.add(attempt);

    try {
      const response = await this.bind(candidate.value);
      return { status: 'bound', candidateWon: candidateWon(response) };
    } catch {
      return { status: 'failed' };
    }
  }
}

export function referralCandidate(search: string): Readonly<{ status: 'candidate'; value: string }> | Readonly<{ status: 'ignored'; reason: 'absent' | 'malformed' }> {
  const values = new URLSearchParams(search).getAll('referral');
  if (values.length === 0) return { status: 'ignored', reason: 'absent' };
  if (values.length !== 1 || !REFERRAL_MEMBER_PATTERN.test(values[0]!)) {
    return { status: 'ignored', reason: 'malformed' };
  }
  return { status: 'candidate', value: values[0]! };
}

export function createSdkReferralBindingExecutor(baseUrl: string, clientVersion = STOREFRONT_CLIENT_VERSION): ReferralBindingExecutor {
  const createBinding = createFetchReferralBindingsCreate(baseUrl);
  return (candidateReferralMemberId) => createBinding({ body: { referralMember: candidateReferralMemberId } }, createRequestContext(clientVersion, { idempotencyKey: createIdempotencyKey() }));
}

let browserCoordinator: ReferralAttributionCoordinator | undefined;

/** Fire-and-forget entry used only after the authenticated bootstrap succeeds. */
export function captureBrowserReferralAttribution(identity: Readonly<{ mallId: string; memberId: string }>): Promise<ReferralAttributionResult> {
  if (typeof window === 'undefined') {
    return Promise.resolve({ status: 'ignored', reason: 'untrusted-context' });
  }
  browserCoordinator ??= new ReferralAttributionCoordinator(createSdkReferralBindingExecutor(window.location.origin));
  return browserCoordinator.capture({
    search: window.location.search,
    mallId: identity.mallId,
    memberId: identity.memberId,
  });
}

function trustedIdentity(value: string): boolean {
  return value.length > 0 && value.length <= 255 && value.trim() === value;
}

function candidateWon(response: unknown): boolean | null {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) return null;
  const value = Reflect.get(response, 'candidate_won');
  return typeof value === 'boolean' ? value : null;
}
