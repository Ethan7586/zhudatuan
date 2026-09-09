import type { VerificationOperations } from '@shop/sdk/verification';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';
import type { MemberCodePort } from '../public';
import type { MemberCode } from '../model/MemberCode';
import { mapMemberCode } from './MemberCodeMapper';

export class MemberCodeGateway implements MemberCodePort {
  constructor(
    private readonly verification: VerificationOperations,
    private readonly context: RequestContextFactory
  ) {}

  async issue(session: StorefrontSession, idempotencyKey: string, signal?: AbortSignal): Promise<MemberCode> {
    const value = await this.verification.membercodesIssue({ body: {} }, this.context(session, { signal, write: true, idempotencyKey }));
    return mapMemberCode(value);
  }

  async revoke(session: StorefrontSession, code: MemberCode, idempotencyKey: string, signal?: AbortSignal): Promise<void> {
    await this.verification.membercodesRevoke(
      { path: { challengeid: code.challenge }, body: {} },
      this.context(session, { signal, write: true, idempotencyKey, expectedVersion: code.version })
    );
  }
}
