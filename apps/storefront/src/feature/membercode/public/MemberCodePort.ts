import type { StorefrontSession } from '../../../entity/session';
import type { MemberCode } from '../model/MemberCode';

export interface MemberCodePort {
  issue(session: StorefrontSession, idempotencyKey: string, signal?: AbortSignal): Promise<MemberCode>;
  revoke(session: StorefrontSession, code: MemberCode, idempotencyKey: string, signal?: AbortSignal): Promise<void>;
}
