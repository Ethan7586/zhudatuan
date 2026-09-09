import type { StorefrontSession } from '../../../entity/session';
import type { MemberCodePort } from '../public';

export class IssueMemberCode {
  constructor(private readonly gateway: Pick<MemberCodePort, 'issue'>) {}

  execute(session: StorefrontSession, idempotencyKey: string, signal?: AbortSignal) {
    return this.gateway.issue(session, idempotencyKey, signal);
  }
}
