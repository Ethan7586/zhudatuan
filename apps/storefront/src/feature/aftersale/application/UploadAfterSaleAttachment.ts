import type { StorefrontSession } from '../../../entity/session';
import type { AfterSalePort } from '../public/AfterSalePort';
import type { AfterSaleAttachmentInput } from '../model/AfterSale';
import { ORDER_AFTERSALE_ATTACHMENT_TYPES } from '@shop/contract';

const allowed = new Set<AfterSaleAttachmentInput['contentType']>(ORDER_AFTERSALE_ATTACHMENT_TYPES);

export class UploadAfterSaleAttachment {
  constructor(private readonly gateway: Pick<AfterSalePort, 'upload'>) {}
  async execute(session: StorefrontSession, orderId: string, file: File): Promise<AfterSaleAttachmentInput> {
    if (!allowed.has(file.type as AfterSaleAttachmentInput['contentType']) || file.size < 1 || file.size > 1_000_000) throw new Error('附件仅支持 1 MB 内的 JPG、PNG 或 PDF 文件');
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    const input = Object.freeze({ name: file.name, contentType: file.type as AfterSaleAttachmentInput['contentType'], sizeBytes: file.size, sha256 });
    return this.gateway.upload(session, orderId, input, file);
  }
}
