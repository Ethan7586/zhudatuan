import type { StorefrontSession } from '../../../entity/session';
import type { Security } from '../model/Security';

export interface SecurityPort {
  read(session: StorefrontSession, signal?: AbortSignal): Promise<Security>;
  password(session: StorefrontSession, currentPassword: string, newPassword: string, key: string): Promise<void>;
  challenge(session: StorefrontSession, mobile: string, key: string): Promise<string>;
  mobile(session: StorefrontSession, mobile: string, challenge: string, code: string, key: string): Promise<void>;
  revoke(session: StorefrontSession, target: string, key: string): Promise<readonly string[]>;
}
