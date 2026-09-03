import type { StorefrontSession } from '../../../entity/session';
import { createIdempotencyKey, uploadObject } from '@shop/sdk';
import type { SupportGateway } from '../infrastructure/SupportGateway';
import type { PendingAttachment, SupportAttachmentType } from '../model/Attachment';

const allowed = new Set<SupportAttachmentType>(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);

export class UploadAttachment {
  constructor(private readonly gateway: SupportGateway) {}
  async execute(session: StorefrontSession, caseId: string, file: File): Promise<PendingAttachment> {
    if (!allowed.has(file.type as SupportAttachmentType) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('附件仅支持 10MB 内的 JPG、PNG、PDF 或 TXT 文件');
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    const intent = await this.gateway.attachment(session, caseId, { name: file.name, contentType: file.type as SupportAttachmentType, sizeBytes: file.size, sha256 }, createIdempotencyKey());
    await uploadObject({ url: intent.upload.url, headers: intent.upload.headers, body: file }).catch(() => {
      throw new Error('附件直传失败，请重新选择文件');
    });
    return Object.freeze({ id: intent.id, name: file.name, state: 'pending' as const });
  }
}
