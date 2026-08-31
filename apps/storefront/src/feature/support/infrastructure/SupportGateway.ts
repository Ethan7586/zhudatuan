import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';
import type { SupportUpload } from '../model/Attachment';
import type { Conversation } from '../model/Message';
import type { SupportPage, SupportPriority } from '../model/SupportCase';
import { mapCases, mapConversation } from './SupportMapper';

export const SupportGateway = Object.freeze({
  async cases(session: StorefrontSession, cursor?: string, signal?: AbortSignal): Promise<SupportPage> {
    const value = await storefrontClient.commerce.support.casesRead({ query: { limit: 50, ...(cursor ? { cursor } : {}) } }, storefrontClient.context(session, { signal }));
    return mapCases(value);
  },
  async create(session: StorefrontSession, subject: string, message: string, priority: SupportPriority, order: string | undefined, key: string): Promise<string> {
    const value = await storefrontClient.commerce.support.casesCreate({ body: { subject, message, priority, channel: 'inapp', ...(order ? { order } : {}) } }, storefrontClient.context(session, { write: true, idempotencyKey: key }));
    return value.id;
  },
  async conversation(session: StorefrontSession, id: string, signal?: AbortSignal): Promise<Conversation> {
    const value = await storefrontClient.commerce.support.messagesRead({ path: { caseid: id }, query: { limit: 200 } }, storefrontClient.context(session, { signal }));
    return mapConversation(value);
  },
  async send(session: StorefrontSession, id: string, message: string, key: string): Promise<void> {
    await storefrontClient.commerce.support.messagesSend({ path: { caseid: id }, body: { message } }, storefrontClient.context(session, { write: true, idempotencyKey: key }));
  },
  async upload(session: StorefrontSession, id: string, upload: SupportUpload, key: string): Promise<void> {
    await storefrontClient.commerce.support.attachmentsCreate(
      { path: { caseid: id }, body: { name: upload.name, data: upload.data, contentType: upload.contentType } },
      storefrontClient.context(session, { write: true, idempotencyKey: key })
    );
  },
});
