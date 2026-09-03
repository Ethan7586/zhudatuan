import type { AuthTarget } from '@shop/config/client';
import type { RegistrationPolicy } from '../../invitation/model/RegistrationPolicy';

export type LoginMethod = 'password' | 'otp' | 'invitation';

export interface PasswordPolicy {
  readonly minimumLength: number;
  readonly maximumLength: number;
  readonly uppercase: boolean;
  readonly lowercase: boolean;
  readonly number: boolean;
  readonly symbol: boolean;
}

export interface Bootstrap {
  readonly target: AuthTarget;
  readonly returnTarget: string;
  readonly expiresAt: number;
  readonly csrf: string;
  readonly methods: readonly ('password' | 'otp' | 'invitation' | 'federation')[];
  readonly preferredMethod: LoginMethod;
  readonly password: Readonly<PasswordPolicy>;
  readonly otp: Readonly<{ validSeconds: number; resendSeconds: number }>;
  readonly legal: RegistrationPolicy;
}
