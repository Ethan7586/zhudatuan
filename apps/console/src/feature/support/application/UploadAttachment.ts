import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { uploadObject } from '@shop/sdk';
import type { SupportGateway } from '../infrastructure/SupportGateway';

export interface UploadedAttachment {
  readonly id: string;
  readonly name: string;
  readonly state: 'uploading' | 'pending' | 'clean' | 'rejected' | 'failed';
  readonly error?: string;
}

export class UploadAttachment {
  constructor(private readonly gateway: SupportGateway) {}
  async execute(context: ConsoleContext, ticket: string, file: File): Promise<UploadedAttachment> {
    if (!['image/jpeg', 'image/png', 'application/pdf', 'text/plain'].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('仅支持 10MB 内的 JPG、PNG、PDF 或 TXT 文件。');
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    const intent = await this.gateway.attachment(context, ticket, { name: file.name, contentType: file.type as 'image/jpeg' | 'image/png' | 'application/pdf' | 'text/plain', sizeBytes: file.size, sha256 });
    await uploadObject({ url: intent.upload.url, headers: intent.upload.headers, body: file }).catch(() => {
      throw new Error('附件直传失败，请重新选择文件。');
    });
    return Object.freeze({ id: intent.id, name: file.name, state: 'pending' as const });
  }
}
