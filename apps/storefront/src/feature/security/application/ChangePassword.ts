import type { StorefrontSession } from '../../../entity/session';
import { SecurityGateway } from '../infrastructure/SecurityGateway';

export class ChangePassword {
  constructor(private readonly gateway: Pick<SecurityGateway, 'password'>) {}
  execute(session: StorefrontSession, currentPassword: string, newPassword: string, confirmation: string): Promise<void> {
    if (!currentPassword || newPassword.length < 12 || newPassword !== confirmation) throw new Error('新密码至少 12 位，且两次输入必须一致');
    return this.gateway.password(session, currentPassword, newPassword, crypto.randomUUID());
  }
}
