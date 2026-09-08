import { DomainError } from '../../../../platform/error/DomainError';
export class AuthenticationPolicy {
  method(value: unknown): 'password' | 'otp' | 'federation' {
    if (value !== 'password' && value !== 'otp' && value !== 'federation') throw new DomainError('IDENTITY_PROVIDER_INVALID');
    return value;
  }
}
