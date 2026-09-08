import { randomBytes } from 'node:crypto';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import { DomainError } from '../../../../platform/error/DomainError';
import type { IdentityAction } from '../model/IdentityAction';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { RegistrationPolicyRepository } from '../port/RegistrationPolicyRepository';
import { passwordPolicyView } from './PasswordPolicyView';
import { registrationPolicyView } from './RegistrationPolicyView';
import { isOperationTarget } from '@shop/contract';

const METHODS = Object.freeze(['password', 'otp', 'federation'] as const);

export class ReadIdentityBootstrap {
  constructor(
    private readonly targets: ReturnTargetPort,
    private readonly registrations: RegistrationPolicyRepository
  ) {}

  action(): IdentityAction<'read'> {
    return async (request, database) => {
      const requested = request.input.headers['x-client-target'];
      if (!isOperationTarget(requested)) throw new DomainError('VALIDATION_FAILED');
      const supplied = request.input.query.returntarget;
      const path = request.input.query.returnpath;
      if ((supplied !== undefined && typeof supplied !== 'string') || (path !== undefined && typeof path !== 'string') || (supplied !== undefined && path !== undefined)) {
        throw new DomainError('VALIDATION_FAILED');
      }
      const target = supplied === undefined ? this.targets.issue(requested, path === undefined ? undefined : { path }) : this.targets.verify(supplied);
      if (target.target !== requested) throw new DomainError('VALIDATION_FAILED');
      const csrf = randomBytes(32).toString('base64url');
      const policy = RUNTIME_LIMITS.authentication;
      const legal = await this.registrations.current(database);
      if (!legal) throw new DomainError('INTERNAL_ERROR');
      return Object.freeze({
        status: 200,
        body: Object.freeze({
          target: target.target,
          returnTarget: target.proof,
          expiresAt: target.expiresAt,
          csrf,
          methods: METHODS,
          preferredMethod: 'password' as const,
          password: passwordPolicyView(policy.password),
          otp: Object.freeze({ validSeconds: policy.otp.validMinutes * 60, resendSeconds: policy.otp.resendSeconds }),
          legal: registrationPolicyView(legal),
        }),
        headers: Object.freeze({
          'cache-control': 'no-store',
          'set-cookie': `__Host-auth-csrf=${csrf}; Path=/; Max-Age=${policy.bootstrap.ttlSeconds}; Secure; HttpOnly; SameSite=Strict`,
        }),
      });
    };
  }
}
