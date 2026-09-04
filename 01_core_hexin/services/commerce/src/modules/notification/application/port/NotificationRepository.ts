import type { DeliveryChannelId, DeliveryVariables, VariableSchema } from '../../domain/model/Template';
import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { DeliveryReceipt } from './DeliveryChannel';

export interface MemberContext { readonly member: string; readonly organization: string }
export interface TemplateRecord {
  readonly id: string; readonly scope_id: string; readonly channel: DeliveryChannelId; readonly event_type: string;
  readonly version: number; readonly variable_schema: VariableSchema; readonly provider_template: string | null;
  readonly subject: string | null; readonly body: string; readonly status: 'draft' | 'active' | 'retired'; readonly created_at: string;
}
export interface DispatchRecord {
  readonly id: string; readonly scope_id: string; readonly member_id: string | null; readonly template_id: string;
  readonly channel: DeliveryChannelId; readonly event_type: string; readonly version: number;
  readonly provider_template: string | null; readonly variable_schema: VariableSchema; readonly subject: string | null;
  readonly body: string; readonly payload: Readonly<Record<string, unknown>>; readonly recipient_ciphertext: string | null;
  readonly recipient_ref: string | null; readonly status: 'draft' | 'active' | 'retired';
}
export interface EndpointRecord { readonly address_ciphertext: string; readonly address_token: string }
export interface ChallengeRecord { readonly purpose: string; readonly code_ciphertext: string; readonly destination_ciphertext: string }
export interface ChallengeAttemptRecord { readonly sequence: number; readonly state: 'sending' | 'sent' | 'ambiguous'; readonly dispatch: boolean }

export interface QueuedDispatch {
  readonly id: string; readonly scope: string; readonly member: string | null; readonly template: string; readonly recipientToken: string;
  readonly recipientCiphertext: string | null; readonly recipientKeyVersion: string | null; readonly recipientRef: string | null;
  readonly variables: DeliveryVariables; readonly subject: string | null; readonly body: string; readonly idempotency: string;
}

export interface NotificationRepository {
  member(membership: string): Promise<MemberContext>;
  preferences(member: string, organization: string, cursor: string | null, fetch: number): Promise<QueryResult<QueryResultRow>>;
  changePreference(member: string, organization: string, channel: DeliveryChannelId, event: string, enabled: boolean,
    authorization: string): Promise<QueryResult<QueryResultRow>>;
  wechatIdentity(membership: string): Promise<QueryResult<{ id: string; subject_ciphertext: string }>>;
  revokeEndpoint(member: string, channel: DeliveryChannelId): Promise<QueryResult<QueryResultRow>>;
  saveEndpoint(member: string, channel: DeliveryChannelId,
    envelope: Readonly<{ ciphertext: string; fingerprint: string; keyVersion: string }>): Promise<QueryResult<QueryResultRow>>;
  notifications(membership: string, includeScope: boolean, cursorTime: string | null, cursorId: string | null,
    fetch: number): Promise<QueryResult<QueryResultRow>>;
  templates(scope: string, cursor: string | null, fetch: number): Promise<QueryResult<TemplateRecord>>;
  saveTemplate(input: Omit<TemplateRecord, 'created_at'>): Promise<QueryResult<TemplateRecord & { matches: boolean; inserted: boolean }>>;
  announcements(scope: string, cursor: string | null, fetch: number): Promise<QueryResult<QueryResultRow>>;
  saveAnnouncement(input: Readonly<{ id: string; scope: string; title: string; body: string; audience: unknown; state: string;
    startsAt: string; endsAt: string | null; expected: number | null }>): Promise<QueryResult<QueryResultRow>>;
  jobScope(job: string): Promise<QueryResult<{ scope_id: string | null }>>;
  eventTemplates(scope: string, event: string, member: string | null): Promise<QueryResult<TemplateRecord>>;
  endpoint(member: string, channel: DeliveryChannelId): Promise<QueryResult<EndpointRecord>>;
  queue(input: QueuedDispatch): Promise<QueryResult<QueryResultRow>>;
  completeInbox(event: string): Promise<QueryResult<QueryResultRow>>;
  claim(id: string): Promise<QueryResult<DispatchRecord>>;
  complete(dispatch: DispatchRecord, receipt: DeliveryReceipt): Promise<QueryResult<QueryResultRow>>;
  fail(dispatch: DispatchRecord, provider: string, code: string): Promise<QueryResult<QueryResultRow>>;
  challenge(id: string): Promise<QueryResult<ChallengeRecord>>;
  beginChallengeAttempt(id: string, provider: string): Promise<QueryResult<ChallengeAttemptRecord>>;
  completeChallengeAttempt(id: string, sequence: number, provider: string, external: string): Promise<QueryResult<QueryResultRow>>;
  failChallengeAttempt(id: string, sequence: number, code: string): Promise<QueryResult<QueryResultRow>>;
  ambiguousChallengeAttempt(id: string, sequence: number, code: string): Promise<QueryResult<QueryResultRow>>;
}

export type NotificationRepositoryFactory = (database: OperationDatabase) => NotificationRepository;
