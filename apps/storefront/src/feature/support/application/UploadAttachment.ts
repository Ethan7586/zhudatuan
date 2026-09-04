import type { StorefrontSession } from '../../../entity/session';
import type { SupportPort } from '../public/SupportPort';
import type { PendingAttachment, SupportAttachmentType } from '../model/Attachment';

const allowed = new Set<SupportAttachmentType>(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);

export class UploadAttachment {
  constructor(private readonly gateway: Pick<SupportPort, 'upload'>) {}
  async execute(session: StorefrontSession, caseId: string, file: File): Promise<PendingAttachment> {
    if (!allowed.has(file.type as SupportAttachmentType) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('附件仅支持 10MB 内的 JPG、PNG、PDF 或 TXT 文件');
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    return this.gateway.upload(session, caseId, { name: file.name, contentType: file.type as SupportAttachmentType, sizeBytes: file.size, sha256 }, file);
  }
}
