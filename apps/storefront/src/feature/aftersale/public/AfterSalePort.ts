import type { StorefrontSession } from '../../../entity/session';
import type { AfterSaleApplyReceipt, AfterSaleAttachmentInput, AfterSalePage, ApplyAfterSaleInput } from '../model/AfterSale';

export type AfterSaleUploadRequest = Omit<AfterSaleAttachmentInput, 'objectId'>;

export interface AfterSalePort {
  read(session: StorefrontSession, orderId: string): Promise<AfterSalePage>;
  apply(session: StorefrontSession, orderId: string, input: ApplyAfterSaleInput, idempotencyKey: string): Promise<AfterSaleApplyReceipt>;
  upload(session: StorefrontSession, orderId: string, input: AfterSaleUploadRequest, file: File): Promise<AfterSaleAttachmentInput>;
}
