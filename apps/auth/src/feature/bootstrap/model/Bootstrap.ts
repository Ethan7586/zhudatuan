import type { AuthTarget } from '@shop/config/client';
import type { OperationOutputFor } from '@shop/contract';
import type { RegistrationPolicy } from '../../enrollment';

export type LoginMethod = Exclude<OperationOutputFor<'identity.bootstrap.read'>['methods'][number], 'federation'>;

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
  readonly methods: Readonly<OperationOutputFor<'identity.bootstrap.read'>['methods']>;
  readonly preferredMethod: LoginMethod;
  readonly password: Readonly<PasswordPolicy>;
  readonly otp: Readonly<{ validSeconds: number; resendSeconds: number }>;
  readonly legal: RegistrationPolicy;
}
