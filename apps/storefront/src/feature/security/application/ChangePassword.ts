import type { StorefrontSession } from '../../../shared/api/Session';
import { SecurityGateway } from '../infrastructure/SecurityGateway';

export class ChangePassword {
  execute(session: StorefrontSession, currentPassword: string, newPassword: string, confirmation: string): Promise<void> {
    if (!currentPassword || newPassword.length < 12 || newPassword !== confirmation) throw new Error('新密码至少 12 位，且两次输入必须一致');
    return SecurityGateway.password(session, currentPassword, newPassword, crypto.randomUUID());
  }
}
