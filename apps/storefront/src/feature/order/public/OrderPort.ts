import type { StorefrontSession } from '../../../entity/session';
import type { EnterpriseMall } from '../../account';
import type { Invoice, InvoiceDownload } from '../model/Invoice';
import type { Order } from '../model/Order';

export interface OrderPort {
  orders(session: StorefrontSession, mall: EnterpriseMall, signal?: AbortSignal): Promise<readonly Order[]>;
  order(session: StorefrontSession, mall: EnterpriseMall, orderId: string, signal?: AbortSignal): Promise<Order | null>;
  cancel(session: StorefrontSession, orderId: string, expectedVersion: number, reason: string, idempotencyKey: string): Promise<void>;
  receive(session: StorefrontSession, orderId: string, expectedVersion: number, idempotencyKey: string): Promise<void>;
  remind(session: StorefrontSession, orderId: string, idempotencyKey: string): Promise<void>;
}

export interface InvoicePort {
  read(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Invoice[]>;
  download(session: StorefrontSession, invoiceId: string, signal?: AbortSignal): Promise<InvoiceDownload>;
}
