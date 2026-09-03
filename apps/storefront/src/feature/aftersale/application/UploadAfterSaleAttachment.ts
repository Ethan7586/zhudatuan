import { createIdempotencyKey, uploadObject } from '@shop/sdk';
import type { StorefrontSession } from '../../../entity/session';
import type { AfterSaleGateway } from '../infrastructure/AfterSaleGateway';
import type { AfterSaleAttachmentInput } from '../model/AfterSale';

const allowed = new Set<AfterSaleAttachmentInput['contentType']>(['image/jpeg', 'image/png', 'application/pdf']);

export class UploadAfterSaleAttachment {
  constructor(private readonly gateway: Pick<AfterSaleGateway, 'authorizeAttachment'>) {}
  async execute(session: StorefrontSession, orderId: string, file: File): Promise<AfterSaleAttachmentInput> {
    if (!allowed.has(file.type as AfterSaleAttachmentInput['contentType']) || file.size < 1 || file.size > 1_000_000) throw new Error('附件仅支持 1 MB 内的 JPG、PNG 或 PDF 文件');
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
    const input = Object.freeze({ name: file.name, contentType: file.type as AfterSaleAttachmentInput['contentType'], sizeBytes: file.size, sha256 });
    const authorization = await this.gateway.authorizeAttachment(session, orderId, input, createIdempotencyKey());
    await uploadObject({ url: authorization.upload.url, headers: authorization.upload.headers, body: file }).catch(() => { throw new Error('附件直传失败，请重新选择文件'); });
    return Object.freeze({ objectId: authorization.objectId, ...input });
  }
}
