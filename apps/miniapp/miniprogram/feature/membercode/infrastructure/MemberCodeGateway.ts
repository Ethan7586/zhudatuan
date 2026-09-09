import { bindSessionRead, bindStepupComplete, bindStepupStart } from '@shop/sdk/identity';
import { bindProfileRead } from '@shop/sdk/member';
import { bindAccountsRead } from '@shop/sdk/benefit';
import { bindMembercodesIssue, bindMembercodesRevoke } from '@shop/sdk/verification';
import type { OperationOutputFor } from '@shop/contract';
import type { AuthorizedRuntime } from '../../../runtime/AuthorizedRuntime';
import type { MemberIdentity, MiniappMemberCode } from '../model/MemberCode';
import { mapMemberCode } from './MemberCodeMapper';

export class MemberCodeGateway {
  constructor(private readonly runtime: AuthorizedRuntime) {}

  identity(signal?: AbortSignal): Promise<MemberIdentity> {
    return this.runtime.authorizedRead(async (executor, context) => {
      const [profile, accounts] = await Promise.all([
        bindProfileRead(executor)({}, context),
        bindAccountsRead(executor)({ query: { limit: 30 } }, context),
      ]);
      const active = accounts.items.filter(({ status }) => status === 'active');
      return Object.freeze({
        name: profile.display_name,
        mobileVerified: profile.mobile_bound,
        welfareMinor: active.filter(({ kind }) => kind !== 'meal').reduce((total, account) => total + account.available_minor, 0),
        mealMinor: active.filter(({ kind }) => kind === 'meal').reduce((total, account) => total + account.available_minor, 0),
      });
    }, signal ? { signal } : {});
  }

  async issue(idempotencyKey: string, signal?: AbortSignal): Promise<MiniappMemberCode> {
    const value = await this.runtime.authorizedWrite<OperationOutputFor<'verification.membercodes.issue'>>(
      (executor, context) => bindMembercodesIssue(executor)({ body: {} }, context),
      { idempotencyKey, ...(signal ? { signal } : {}) }
    );
    return mapMemberCode(value);
  }

  async revoke(code: MiniappMemberCode, idempotencyKey: string, signal?: AbortSignal): Promise<void> {
    await this.runtime.authorizedWrite(
      (executor, context) => bindMembercodesRevoke(executor)({ path: { challengeid: code.challenge }, body: {} }, context),
      { idempotencyKey, expectedVersion: code.version, ...(signal ? { signal } : {}) }
    );
  }

  async phoneMasked(signal?: AbortSignal): Promise<string | null> {
    const session = await this.runtime.authorizedRead<OperationOutputFor<'identity.session.read'>>(
      (executor, context) => bindSessionRead(executor)({}, context),
      { includeScope: false, ...(signal ? { signal } : {}) }
    );
    return session.security.phoneMasked;
  }

  startStepup(idempotencyKey: string, signal?: AbortSignal) {
    return this.runtime.authorizedWrite<OperationOutputFor<'identity.stepup.start'>>(
      (executor, context) => bindStepupStart(executor)({ body: {} }, context),
      { idempotencyKey, includeScope: false, ...(signal ? { signal } : {}) }
    );
  }

  completeStepup(challenge: string, code: string, idempotencyKey: string, signal?: AbortSignal) {
    return this.runtime.authorizedWrite<OperationOutputFor<'identity.stepup.complete'>>(
      (executor, context) => bindStepupComplete(executor)({ body: { challenge, code } }, context),
      { idempotencyKey, includeScope: false, ...(signal ? { signal } : {}) }
    );
  }
}
