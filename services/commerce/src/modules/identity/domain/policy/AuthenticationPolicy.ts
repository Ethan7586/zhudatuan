import { DomainError } from '../../../../foundation/domain/DomainError';
export class AuthenticationPolicy {
  method(value: unknown): 'password' | 'otp' | 'invitation' | 'federation' {
    if (value !== 'password' && value !== 'otp' && value !== 'invitation' && value !== 'federation') throw new DomainError('IDENTITY_PROVIDER_INVALID');
    return value;
  }
}
