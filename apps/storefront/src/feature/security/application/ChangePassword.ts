import type { StorefrontSession } from '../../../entity/session';
import type { SecurityPort } from '../public/SecurityPort';

export class ChangePassword {
  constructor(private readonly gateway: Pick<SecurityPort, 'password'>) {}
  execute(session: StorefrontSession, currentPassword: string, newPassword: string, confirmation: string): Promise<void> {
    if (!currentPassword || newPassword.length < 12 || newPassword !== confirmation) throw new Error('新密码至少 12 位，且两次输入必须一致');
    return this.gateway.password(session, currentPassword, newPassword, crypto.randomUUID());
  }
}
