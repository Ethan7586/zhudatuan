import type { AuthTarget } from '@shop/config/client';
import type { Membership } from '../../membership';

export type LoginOutcome =
  | Readonly<{ kind: 'authenticated'; redirectUrl: string }>
  | Readonly<{ kind: 'membership'; transaction: string; memberships: readonly Membership[] }>
  | Readonly<{ kind: 'proof'; reference: string; expiresAt: string; method: 'otp' | 'sso'; target: AuthTarget }>
  | Readonly<{ kind: 'enrollment'; id: string; expiresAt: string }>
  | Readonly<{ kind: 'enrolled'; target: 'storefront' }>;
