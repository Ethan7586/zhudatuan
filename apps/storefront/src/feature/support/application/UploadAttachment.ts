import type { StorefrontSession } from '../../../shared/api/Session';
import { SupportGateway } from '../infrastructure/SupportGateway';
import type { SupportAttachmentType } from '../model/Attachment';

const allowed = new Set<SupportAttachmentType>(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);

export class UploadAttachment {
  async execute(session: StorefrontSession, caseId: string, file: File): Promise<void> {
    if (!allowed.has(file.type as SupportAttachmentType) || file.size < 1 || file.size > 1_000_000) throw new Error('附件仅支持 1MB 内的 JPG、PNG、PDF 或 TXT 文件');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    await SupportGateway.upload(session, caseId, { name: file.name, data: btoa(binary), contentType: file.type as SupportAttachmentType }, crypto.randomUUID());
  }
}
