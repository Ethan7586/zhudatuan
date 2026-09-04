import type { CipherEnvelope } from '../../../../foundation/infrastructure/KmsClient';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DeliveryChannelId, VariableSchema } from '../../domain/model/Template';

export interface NotificationMember {
  readonly member: string;
  readonly organization: string;
}
export interface WechatRecipient {
  readonly id: string;
  readonly subjectCiphertext: string;
}
export interface NotificationTemplate {
  readonly id: string;
  readonly scopeId: string;
  readonly channel: DeliveryChannelId;
  readonly eventType: string;
  readonly version: number;
  readonly variableSchema: VariableSchema;
  readonly providerTemplate: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly status: 'draft' | 'active' | 'retired';
  readonly createdAt?: string;
}
export interface SavedTemplate extends NotificationTemplate {
  readonly matches: boolean;
  readonly inserted: boolean;
}

export interface NotificationRepository {
  member(context: ReadTransactionContext, membership: string): Promise<NotificationMember>;
  preferences(context: ReadTransactionContext, member: string, organization: string, cursor: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  changePreference(context: WriteTransactionContext, member: string, organization: string, channel: DeliveryChannelId, event: string, enabled: boolean, authorization: string): Promise<Readonly<Record<string, unknown>> | null>;
  wechatRecipient(context: ReadTransactionContext, membership: string): Promise<WechatRecipient | null>;
  revokeEndpoint(context: WriteTransactionContext, member: string, channel: DeliveryChannelId): Promise<Readonly<Record<string, unknown>> | null>;
  saveEndpoint(context: WriteTransactionContext, member: string, channel: DeliveryChannelId, envelope: CipherEnvelope): Promise<Readonly<Record<string, unknown>>>;
  notifications(context: ReadTransactionContext, membership: string, includeScope: boolean, cursorTime: string | null, cursorId: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  acknowledge(context: WriteTransactionContext, membership: string, notification: string): Promise<Readonly<Record<string, unknown>> | null>;
  templates(context: ReadTransactionContext, scope: string, channel: DeliveryChannelId | null, cursor: string | null, fetch: number): Promise<readonly NotificationTemplate[]>;
  saveTemplate(context: WriteTransactionContext, input: Omit<NotificationTemplate, 'createdAt'> & Readonly<{ expectedVersion: number }>): Promise<SavedTemplate | null>;
  announcements(context: ReadTransactionContext, scope: string, cursor: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  saveAnnouncement(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; title: string; body: string; audience: unknown; state: string; startsAt: string; endsAt: string | null; expected: number | null }>
  ): Promise<Readonly<Record<string, unknown>> | null>;
}
