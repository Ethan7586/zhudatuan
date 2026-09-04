import type { StorefrontSession } from '../../../entity/session';
import type { AfterSaleAttachmentInput, AfterSalePage, ApplyAfterSaleInput } from '../model/AfterSale';

export type AfterSaleUploadRequest = Omit<AfterSaleAttachmentInput, 'objectId'>;

export interface AfterSalePort {
  read(session: StorefrontSession, orderId: string): Promise<AfterSalePage>;
  apply(session: StorefrontSession, orderId: string, input: ApplyAfterSaleInput, idempotencyKey: string): Promise<Readonly<{ id: string; state: 'reviewing' }>>;
  upload(session: StorefrontSession, orderId: string, input: AfterSaleUploadRequest, file: File): Promise<AfterSaleAttachmentInput>;
}
