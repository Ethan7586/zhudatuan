import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { SupportPort } from '../public';

export class UploadAttachment {
  constructor(private readonly gateway: SupportPort) {}

  execute(context: ConsoleContext, ticket: string, file: File) {
    if (!['image/jpeg', 'image/png', 'application/pdf', 'text/plain'].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      throw new Error('仅支持 10MB 内的 JPG、PNG、PDF 或 TXT 文件。');
    }
    return this.gateway.upload(context, ticket, file);
  }
}
