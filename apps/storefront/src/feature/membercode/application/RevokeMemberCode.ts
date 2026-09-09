import type { StorefrontSession } from '../../../entity/session';
import type { MemberCode } from '../model/MemberCode';
import type { MemberCodePort } from '../public';

export class RevokeMemberCode {
  constructor(private readonly gateway: Pick<MemberCodePort, 'revoke'>) {}

  execute(session: StorefrontSession, code: MemberCode, idempotencyKey: string, signal?: AbortSignal) {
    return this.gateway.revoke(session, code, idempotencyKey, signal);
  }
}
