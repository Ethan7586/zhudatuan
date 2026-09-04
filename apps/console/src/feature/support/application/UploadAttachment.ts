import { OP_SUPPORT_ATTACHMENTS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { SupportPort } from '../public';

export class UploadAttachment {
  constructor(private readonly gateway: SupportPort) {}

  execute(context: ConsoleContext, ticket: string, file: File) {
    assertOperationAccess(context, OP_SUPPORT_ATTACHMENTS_CREATE);
    if (!context.session.csrf) throw new Error('安全会话已过期，请重新登录。');
    if (!['image/jpeg', 'image/png', 'application/pdf', 'text/plain'].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      throw new Error('仅支持 10MB 内的 JPG、PNG、PDF 或 TXT 文件。');
    }
    return this.gateway.upload(context, ticket, file);
  }
}
