import type { StorefrontSession } from '../../../entity/session';
import { SecurityGateway } from '../infrastructure/SecurityGateway';

export class ChangeMobile {
  constructor(private readonly gateway: Pick<SecurityGateway, 'challenge' | 'mobile'>) {}
  start(session: StorefrontSession, mobile: string): Promise<string> {
    if (!/^1[3-9]\d{9}$/.test(mobile)) throw new Error('请输入有效手机号');
    return this.gateway.challenge(session, mobile, crypto.randomUUID());
  }
  complete(session: StorefrontSession, mobile: string, challenge: string, code: string): Promise<void> {
    if (!challenge || !/^\d{4,8}$/.test(code)) throw new Error('请输入有效验证码');
    return this.gateway.mobile(session, mobile, challenge, code, crypto.randomUUID());
  }
}
